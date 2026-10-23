#!/usr/bin/env python3
"""Validate an Xcode project.pbxproj object graph.

Uses the pbxproj package (OpenStep parser). Duplicate object IDs are detected
from the file text because OpenStep dictionaries keep only the last value.

    pip install pbxproj
    python3 scripts/validate-pbxproj.py [path/to/project.pbxproj]
"""

from __future__ import annotations

import re
import sys
import xml.etree.ElementTree as ET
from collections import defaultdict
from pathlib import Path

try:
    from pbxproj import XcodeProject
except ImportError:
    sys.stderr.write("Install the pbxproj package: pip install pbxproj\n")
    sys.exit(2)

GROUP_CHILD_ISAS = {
    "PBXFileReference",
    "PBXGroup",
    "PBXVariantGroup",
    "PBXReferenceProxy",
    "XCVersionGroup",
}
BUILD_PHASE_ISAS = {
    "PBXSourcesBuildPhase",
    "PBXFrameworksBuildPhase",
    "PBXResourcesBuildPhase",
    "PBXCopyFilesBuildPhase",
    "PBXShellScriptBuildPhase",
    "PBXHeadersBuildPhase",
}
BUILD_FILE_REF_ISAS = {
    "PBXFileReference",
    "PBXReferenceProxy",
    "PBXVariantGroup",
    "XCVersionGroup",
}
PRODUCT_FILE_TYPES = {
    "com.apple.product-type.application": "wrapper.application",
    "com.apple.product-type.app-extension": "wrapper.app-extension",
}
DEFINITION_RE = re.compile(
    r"^(?:\t{2}| {8})([A-F0-9]{24})(?: /\*.*?\*/)? = \{"
)


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def ok(self) -> bool:
        return not self.errors


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def object_id(obj) -> str:
    if obj is None:
        return ""
    getter = getattr(obj, "get_id", None)
    if callable(getter):
        found = getter()
        if found:
            return str(found)
    return str(getattr(obj, "_id", ""))


def definition_sites(text: str) -> list[tuple[str, str | None, int]]:
    lines = text.splitlines()
    found: list[tuple[str, str | None, int]] = []
    for index, line in enumerate(lines):
        match = DEFINITION_RE.match(line)
        if not match:
            continue
        isa = None
        inline = re.search(r"\bisa = ([A-Za-z0-9]+);", line)
        if inline:
            isa = inline.group(1)
        else:
            for follower in lines[index + 1 : index + 6]:
                isa_match = re.search(r"\bisa = ([A-Za-z0-9]+);", follower)
                if isa_match:
                    isa = isa_match.group(1)
                    break
                if DEFINITION_RE.match(follower):
                    break
        found.append((match.group(1), isa, index + 1))
    return found


def check_duplicate_definitions(text: str, report: Report) -> None:
    sites: dict[str, list[tuple[str | None, int]]] = defaultdict(list)
    for object_id_, isa, line in definition_sites(text):
        sites[object_id_].append((isa, line))
    for object_id_, entries in sorted(sites.items()):
        if len(entries) < 2:
            continue
        detail = ", ".join(
            f"line {line} ({isa or 'unknown isa'})" for isa, line in entries
        )
        report.error(f"duplicate object ID {object_id_}: {detail}")


def lookup(objects, ref, report: Report, context: str):
    if ref is None or str(ref) == "":
        report.error(f"{context}: missing reference")
        return None
    obj = objects[str(ref)]
    if obj is None:
        report.error(f"{context}: ID {ref} does not exist")
        return None
    return obj


def expect_isa(obj, expected: set[str], report: Report, context: str):
    if obj is None:
        return None
    isa = getattr(obj, "isa", None)
    if isa not in expected:
        report.error(
            f"{context}: expected {' or '.join(sorted(expected))}, "
            f"found {isa or 'no isa'} (ID {object_id(obj) or '?'})"
        )
        return None
    return obj


def build_parent_map(objects) -> dict[str, str]:
    parents: dict[str, str] = {}
    for key in objects.get_keys():
        group = objects[key]
        if getattr(group, "isa", None) != "PBXGroup":
            continue
        for child in as_list(getattr(group, "children", None)):
            parents[str(child)] = str(key)
    return parents


def group_parts(group_id: str, objects, parents: dict[str, str], main_id: str) -> list[str]:
    parts: list[str] = []
    seen: set[str] = set()
    current = group_id
    while current and current not in seen:
        seen.add(current)
        if current == main_id:
            break
        group = objects[current]
        path = getattr(group, "path", None) if group is not None else None
        if path:
            parts.append(str(path))
        current = parents.get(current, "")
    parts.reverse()
    return parts


def resolve_file(ref, objects, parents: dict[str, str], main_id: str, srcroot: Path) -> Path | None:
    source = str(getattr(ref, "sourceTree", ""))
    path = getattr(ref, "path", None)
    if source == "BUILT_PRODUCTS_DIR" or not path:
        return None
    relative = Path(str(path))
    if source == "<group>":
        parent = parents.get(object_id(ref))
        if parent:
            base = srcroot.joinpath(*group_parts(parent, objects, parents, main_id))
            return base / relative
        return srcroot / relative
    if source in {"SOURCE_ROOT", "<absolute>"}:
        if source == "<absolute>":
            return Path(str(path))
        return srcroot / relative
    return None


def setting(config, name: str):
    settings = getattr(config, "buildSettings", None)
    if settings is None:
        return None
    return settings[name]


def check_groups(objects, report: Report) -> None:
    for key in objects.get_keys():
        group = objects[key]
        if getattr(group, "isa", None) != "PBXGroup":
            continue
        label = getattr(group, "name", None) or getattr(group, "path", None) or key
        for child in as_list(getattr(group, "children", None)):
            child_obj = lookup(objects, child, report, f"PBXGroup {label} child")
            expect_isa(
                child_obj,
                GROUP_CHILD_ISAS,
                report,
                f"PBXGroup {label} child {child}",
            )


def check_products(project_obj, objects, report: Report) -> dict[str, object]:
    products_id = str(project_obj["productRefGroup"])
    products = lookup(objects, products_id, report, "PBXProject.productRefGroup")
    products = expect_isa(products, {"PBXGroup"}, report, "PBXProject.productRefGroup")
    by_target: dict[str, object] = {}
    if products is None:
        return by_target

    child_ids = [str(child) for child in as_list(products["children"])]
    for target_ref in as_list(project_obj["targets"]):
        target = lookup(objects, target_ref, report, "PBXProject.targets")
        target = expect_isa(target, {"PBXNativeTarget"}, report, f"target {target_ref}")
        if target is None:
            continue
        product = lookup(
            objects,
            target["productReference"],
            report,
            f"target {target['name']} productReference",
        )
        product = expect_isa(
            product,
            {"PBXFileReference"},
            report,
            f"target {target['name']} productReference",
        )
        if product is None:
            continue
        product_id = object_id(product)
        by_target[object_id(target)] = product
        if product_id not in child_ids:
            report.error(
                f"target {target['name']} productReference {product_id} "
                f"is not a child of the Products group"
            )
        if str(getattr(product, "sourceTree", "")) != "BUILT_PRODUCTS_DIR":
            report.error(
                f"product {product['path']} sourceTree must be BUILT_PRODUCTS_DIR, "
                f"found {getattr(product, 'sourceTree', None)}"
            )
        expected_type = PRODUCT_FILE_TYPES.get(str(target["productType"]))
        actual_type = str(getattr(product, "explicitFileType", ""))
        if expected_type is None:
            report.error(
                f"target {target['name']} has unsupported productType {target['productType']}"
            )
        elif actual_type != expected_type:
            report.error(
                f"product {getattr(product, 'path', product_id)} explicitFileType "
                f"must be {expected_type}, found {actual_type or 'missing'}"
            )
        expected_path = f"{target['name']}.{ 'app' if expected_type == 'wrapper.application' else 'appex' }"
        if expected_type and str(getattr(product, "path", "")) != expected_path:
            report.error(
                f"product path {getattr(product, 'path', None)!r} does not match "
                f"target name {expected_path!r}"
            )

    for child in child_ids:
        child_obj = objects[child]
        if child_obj is None or getattr(child_obj, "isa", None) != "PBXFileReference":
            continue
        if str(getattr(child_obj, "sourceTree", "")) != "BUILT_PRODUCTS_DIR":
            report.error(
                f"Products child {child} sourceTree must be BUILT_PRODUCTS_DIR"
            )
        if object_id(child_obj) not in {object_id(item) for item in by_target.values()}:
            report.error(
                f"Products child {child} is not the productReference of any target"
            )
    return by_target


def check_build_phases(project_obj, objects, report: Report) -> None:
    seen_phases: dict[str, str] = {}
    seen_files: dict[str, str] = {}
    for target_ref in as_list(project_obj["targets"]):
        target = objects[str(target_ref)]
        if target is None or getattr(target, "isa", None) != "PBXNativeTarget":
            continue
        for phase_ref in as_list(target["buildPhases"]):
            phase = lookup(
                objects,
                phase_ref,
                report,
                f"target {target['name']} buildPhases",
            )
            phase = expect_isa(
                phase,
                BUILD_PHASE_ISAS,
                report,
                f"target {target['name']} build phase {phase_ref}",
            )
            if phase is None:
                continue
            phase_id = object_id(phase)
            if phase_id in seen_phases:
                report.error(
                    f"build phase {phase_id} is shared by targets "
                    f"{seen_phases[phase_id]} and {target['name']}"
                )
            seen_phases[phase_id] = str(target["name"])
            for file_ref in as_list(phase["files"]):
                build_file = lookup(
                    objects,
                    file_ref,
                    report,
                    f"build phase {getattr(phase, 'name', phase.isa)} files",
                )
                build_file = expect_isa(
                    build_file,
                    {"PBXBuildFile"},
                    report,
                    f"build phase {getattr(phase, 'name', phase.isa)} file {file_ref}",
                )
                if build_file is None:
                    continue
                build_file_id = object_id(build_file)
                if build_file_id in seen_files:
                    report.error(
                        f"PBXBuildFile {build_file_id} is listed in more than one build phase"
                    )
                seen_files[build_file_id] = phase_id
                ref = lookup(
                    objects,
                    build_file["fileRef"],
                    report,
                    f"PBXBuildFile {build_file_id} fileRef",
                )
                expect_isa(
                    ref,
                    BUILD_FILE_REF_ISAS,
                    report,
                    f"PBXBuildFile {build_file_id} fileRef",
                )


def check_embed_and_dependencies(project_obj, objects, report: Report, project_id: str) -> None:
    targets = []
    for target_ref in as_list(project_obj["targets"]):
        target = objects[str(target_ref)]
        if target is not None and getattr(target, "isa", None) == "PBXNativeTarget":
            targets.append(target)

    app_targets = [
        target
        for target in targets
        if str(target["productType"]) == "com.apple.product-type.application"
    ]
    extension_targets = [
        target
        for target in targets
        if str(target["productType"]) == "com.apple.product-type.app-extension"
    ]
    if not app_targets:
        report.error("project has no application target")
        return
    if not extension_targets:
        report.error("project has no app-extension target")

    for app in app_targets:
        embed_phases = []
        for phase_ref in as_list(app["buildPhases"]):
            phase = objects[str(phase_ref)]
            if phase is None or getattr(phase, "isa", None) != "PBXCopyFilesBuildPhase":
                continue
            spec = getattr(phase, "dstSubfolderSpec", None)
            if str(spec) == "13":
                embed_phases.append(phase)
            else:
                report.error(
                    f"PBXCopyFilesBuildPhase {object_id(phase)} on {app['name']} "
                    f"dstSubfolderSpec must be 13 for embedded app extensions, found {spec}"
                )
        if len(embed_phases) != 1:
            report.error(
                f"application target {app['name']} must have exactly one "
                f"Embed Foundation Extensions copy phase (dstSubfolderSpec 13), "
                f"found {len(embed_phases)}"
            )
            continue

        embedded_ids = set()
        for file_ref in as_list(embed_phases[0]["files"]):
            build_file = objects[str(file_ref)]
            if build_file is None:
                continue
            ref = objects[str(build_file["fileRef"])] if build_file["fileRef"] else None
            if ref is None:
                continue
            if str(getattr(ref, "explicitFileType", "")) != "wrapper.app-extension":
                report.error(
                    f"embed phase fileRef {object_id(ref)} must be the .appex product "
                    f"file reference"
                )
                continue
            embedded_ids.add(object_id(ref))

        dependency_targets = {}
        for dep_ref in as_list(app["dependencies"]):
            dependency = lookup(
                objects, dep_ref, report, f"target {app['name']} dependencies"
            )
            dependency = expect_isa(
                dependency,
                {"PBXTargetDependency"},
                report,
                f"target {app['name']} dependency {dep_ref}",
            )
            if dependency is None:
                continue
            dep_target = lookup(
                objects,
                dependency["target"],
                report,
                f"PBXTargetDependency {object_id(dependency)} target",
            )
            dep_target = expect_isa(
                dep_target,
                {"PBXNativeTarget"},
                report,
                f"PBXTargetDependency {object_id(dependency)} target",
            )
            proxy = lookup(
                objects,
                dependency["targetProxy"],
                report,
                f"PBXTargetDependency {object_id(dependency)} targetProxy",
            )
            proxy = expect_isa(
                proxy,
                {"PBXContainerItemProxy"},
                report,
                f"PBXTargetDependency {object_id(dependency)} targetProxy",
            )
            if dep_target is None or proxy is None:
                continue
            dependency_targets[object_id(dep_target)] = dep_target
            if str(getattr(proxy, "proxyType", "")) != "1":
                report.error(
                    f"PBXContainerItemProxy {object_id(proxy)} proxyType must be 1, "
                    f"found {getattr(proxy, 'proxyType', None)}"
                )
            portal = lookup(
                objects,
                proxy["containerPortal"],
                report,
                f"PBXContainerItemProxy {object_id(proxy)} containerPortal",
            )
            if portal is not None and object_id(portal) != project_id:
                report.error(
                    f"PBXContainerItemProxy {object_id(proxy)} containerPortal "
                    f"must be the PBXProject ({project_id})"
                )
            remote = str(getattr(proxy, "remoteGlobalIDString", ""))
            if remote != object_id(dep_target):
                report.error(
                    f"PBXContainerItemProxy {object_id(proxy)} remoteGlobalIDString "
                    f"{remote} does not match dependency target {object_id(dep_target)}"
                )
            remote_obj = objects[remote] if remote else None
            if remote_obj is None or getattr(remote_obj, "isa", None) != "PBXNativeTarget":
                report.error(
                    f"PBXContainerItemProxy {object_id(proxy)} remoteGlobalIDString "
                    f"must reference a PBXNativeTarget"
                )
            remote_info = str(getattr(proxy, "remoteInfo", ""))
            if dep_target is not None and remote_info != str(dep_target["name"]):
                report.error(
                    f"PBXContainerItemProxy {object_id(proxy)} remoteInfo {remote_info!r} "
                    f"does not match target name {dep_target['name']!r}"
                )

        for extension in extension_targets:
            product = objects[str(extension["productReference"])]
            product_id = object_id(product) if product is not None else ""
            if product_id not in embedded_ids:
                report.error(
                    f"extension {extension['name']} product is not embedded by "
                    f"{app['name']} (copy phase dstSubfolderSpec 13)"
                )
            if object_id(extension) not in dependency_targets:
                report.error(
                    f"application target {app['name']} is missing a target dependency "
                    f"on {extension['name']}"
                )


def check_configurations(project_obj, objects, report: Report, srcroot: Path) -> None:
    lists: dict[str, str] = {}

    def check_list(list_ref, owner: str) -> None:
        config_list = lookup(objects, list_ref, report, f"{owner} buildConfigurationList")
        config_list = expect_isa(
            config_list,
            {"XCConfigurationList"},
            report,
            f"{owner} buildConfigurationList",
        )
        if config_list is None:
            return
        list_id = object_id(config_list)
        if list_id in lists:
            report.error(
                f"XCConfigurationList {list_id} is shared by {lists[list_id]} and {owner}"
            )
        lists[list_id] = owner
        names = []
        for config_ref in as_list(config_list["buildConfigurations"]):
            config = lookup(
                objects,
                config_ref,
                report,
                f"{owner} buildConfigurations",
            )
            config = expect_isa(
                config,
                {"XCBuildConfiguration"},
                report,
                f"{owner} configuration {config_ref}",
            )
            if config is None:
                continue
            names.append(str(config["name"]))
            if not owner.startswith("target "):
                continue
            for key in ("INFOPLIST_FILE", "CODE_SIGN_ENTITLEMENTS"):
                value = setting(config, key)
                if not value:
                    report.error(f"{owner} configuration {config['name']} is missing {key}")
                    continue
                path = srcroot / str(value)
                if not path.is_file():
                    report.error(
                        f"{owner} configuration {config['name']} {key} does not exist: {path}"
                    )
        for required in ("Debug", "Release"):
            if required not in names:
                report.error(f"{owner} configuration list is missing {required}")

    check_list(project_obj["buildConfigurationList"], "PBXProject")
    for target_ref in as_list(project_obj["targets"]):
        target = objects[str(target_ref)]
        if target is None or getattr(target, "isa", None) != "PBXNativeTarget":
            continue
        check_list(target["buildConfigurationList"], f"target {target['name']}")


def check_file_paths(objects, parents: dict[str, str], main_id: str, srcroot: Path, report: Report) -> None:
    for key in objects.get_keys():
        ref = objects[key]
        if getattr(ref, "isa", None) != "PBXFileReference":
            continue
        if str(getattr(ref, "sourceTree", "")) == "BUILT_PRODUCTS_DIR":
            continue
        if object_id(ref) not in parents:
            report.error(f"PBXFileReference {key} is not a child of any PBXGroup")
            continue
        resolved = resolve_file(ref, objects, parents, main_id, srcroot)
        if resolved is None:
            report.error(f"PBXFileReference {key} has no resolvable path")
            continue
        file_type = str(getattr(ref, "lastKnownFileType", "") or getattr(ref, "explicitFileType", ""))
        directory_types = {"folder", "folder.assetcatalog", "wrapper.cfbundle"}
        if file_type in directory_types:
            if not resolved.is_dir():
                report.error(f"PBXFileReference {getattr(ref, 'path', key)} directory is missing: {resolved}")
        elif not resolved.is_file():
            report.error(f"PBXFileReference {getattr(ref, 'path', key)} file is missing: {resolved}")


def check_schemes(xcodeproj: Path, objects, report: Report) -> None:
    schemes = xcodeproj / "xcshareddata" / "xcschemes"
    if not schemes.is_dir():
        report.error(f"missing shared schemes directory: {schemes}")
        return
    found = False
    for scheme in sorted(schemes.glob("*.xcscheme")):
        found = True
        try:
            root = ET.parse(scheme).getroot()
        except ET.ParseError as exc:
            report.error(f"{scheme.name} is not valid XML: {exc}")
            continue
        for element in root.iter():
            blueprint = element.attrib.get("BlueprintIdentifier")
            if not blueprint:
                continue
            target = objects[blueprint]
            if target is None or getattr(target, "isa", None) != "PBXNativeTarget":
                report.error(
                    f"{scheme.name} BlueprintIdentifier {blueprint} is not a PBXNativeTarget"
                )
            container = element.attrib.get("ReferencedContainer", "")
            if container and xcodeproj.name not in container:
                report.error(
                    f"{scheme.name} ReferencedContainer {container!r} does not name {xcodeproj.name}"
                )
    if not found:
        report.error(f"no shared xcscheme in {schemes}")


def validate(pbxproj_path: Path) -> Report:
    report = Report()
    text = pbxproj_path.read_text(encoding="utf-8")
    check_duplicate_definitions(text, report)

    project = XcodeProject.load(str(pbxproj_path))
    objects = project.objects
    defined = len(definition_sites(text))
    parsed = len(objects.get_keys())
    if defined != parsed:
        report.error(
            f"parsed {parsed} objects but found {defined} object definitions "
            "(duplicate IDs collapse when the OpenStep dictionary is loaded)"
        )

    project_id = str(project["rootObject"])
    project_obj = lookup(objects, project_id, report, "rootObject")
    project_obj = expect_isa(project_obj, {"PBXProject"}, report, "rootObject")
    if project_obj is None:
        return report

    main = lookup(objects, project_obj["mainGroup"], report, "PBXProject.mainGroup")
    main = expect_isa(main, {"PBXGroup"}, report, "PBXProject.mainGroup")
    check_groups(objects, report)
    check_products(project_obj, objects, report)
    check_build_phases(project_obj, objects, report)
    check_embed_and_dependencies(project_obj, objects, report, project_id)
    srcroot = pbxproj_path.parent.parent
    check_configurations(project_obj, objects, report, srcroot)
    if main is not None:
        parents = build_parent_map(objects)
        check_file_paths(objects, parents, object_id(main), srcroot, report)
    check_schemes(pbxproj_path.parent, objects, report)

    attributes = project_obj["attributes"]
    target_attributes = None if attributes is None else attributes["TargetAttributes"]
    if target_attributes is not None:
        for key in target_attributes.get_keys():
            if objects[str(key)] is None or getattr(objects[str(key)], "isa", None) != "PBXNativeTarget":
                report.error(f"TargetAttributes key {key} is not a PBXNativeTarget")
    return report


def main() -> int:
    default = (
        Path(__file__).resolve().parent.parent
        / "safari"
        / "Grokipedia Redirect"
        / "Grokipedia Redirect.xcodeproj"
        / "project.pbxproj"
    )
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else default
    if path.is_dir():
        path = path / "project.pbxproj"
    if not path.is_file():
        sys.stderr.write(f"project.pbxproj not found: {path}\n")
        return 2
    report = validate(path)
    if not report.ok():
        for message in report.errors:
            print(f"ERROR: {message}")
        print(f"{len(report.errors)} error(s) in {path}")
        return 1
    print(f"OK: {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
