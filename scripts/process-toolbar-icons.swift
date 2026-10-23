#!/usr/bin/env swift
import AppKit
import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Safari templates pure grayscale toolbar icons (blue tint).
// Active: keep the B&W look but inject tiny chroma so Safari leaves colors alone.
// Inactive: muted mid-contrast variant for the disabled toggle state.

guard CommandLine.arguments.count >= 3 else {
    fputs("Usage: process-toolbar-icons.swift <source.png> <icons-dir>\n", stderr)
    exit(1)
}

let sourcePath = CommandLine.arguments[1]
let iconsDir = CommandLine.arguments[2]
let sourceURL = URL(fileURLWithPath: sourcePath)

guard let sourceImage = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
      let cgImage = CGImageSourceCreateImageAtIndex(sourceImage, 0, nil) else {
    fputs("Could not load \(sourcePath)\n", stderr)
    exit(1)
}

let srcWidth = cgImage.width
let srcHeight = cgImage.height

guard let context = CGContext(
    data: nil,
    width: srcWidth,
    height: srcHeight,
    bitsPerComponent: 8,
    bytesPerRow: srcWidth * 4,
    space: CGColorSpaceCreateDeviceRGB(),
    bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
) else {
    fputs("Could not create bitmap context\n", stderr)
    exit(1)
}

context.draw(cgImage, in: CGRect(x: 0, y: 0, width: srcWidth, height: srcHeight))
guard let srcData = context.data else {
    fputs("Missing pixel data\n", stderr)
    exit(1)
}

let srcPtr = srcData.bindMemory(to: UInt8.self, capacity: srcWidth * srcHeight * 4)

func sample(x: Int, y: Int) -> (r: Double, g: Double, b: Double) {
    let sx = max(0, min(srcWidth - 1, x))
    let sy = max(0, min(srcHeight - 1, y))
    let i = (sy * srcWidth + sx) * 4
    return (
        Double(srcPtr[i]) / 255.0,
        Double(srcPtr[i + 1]) / 255.0,
        Double(srcPtr[i + 2]) / 255.0
    )
}

func activeColor(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    // Warm near-black / paper-white: clearly chromatic so Safari won't template-tint blue.
    if luma < 0.5 {
        return (min(1, max(0, luma) * 0.55 + 0.08), max(0, luma) * 0.45 + 0.02, max(0, luma) * 0.25)
    }
    return (min(1, 0.98 + luma * 0.02), min(1, 0.96 + luma * 0.02), min(1, 0.90 + luma * 0.05))
}

func mutedColor(_ r: Double, _ g: Double, _ b: Double) -> (Double, Double, Double) {
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    let muted = 0.42 + (luma - 0.5) * 0.38
    return (min(1, muted + 0.03), muted, max(0, muted - 0.02))
}

func render(size: Int, transform: (Double, Double, Double) -> (Double, Double, Double)) -> CGImage {
    guard let out = CGContext(
        data: nil,
        width: size,
        height: size,
        bitsPerComponent: 8,
        bytesPerRow: size * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ), let outData = out.data else {
        fputs("Could not create output context\n", stderr)
        exit(1)
    }

    let ptr = outData.bindMemory(to: UInt8.self, capacity: size * size * 4)
    for y in 0..<size {
        for x in 0..<size {
            let sx = Int((Double(x) + 0.5) * Double(srcWidth) / Double(size))
            let sy = Int((Double(y) + 0.5) * Double(srcHeight) / Double(size))
            let p = sample(x: sx, y: sy)
            let c = transform(p.r, p.g, p.b)
            let i = (y * size + x) * 4
            ptr[i] = UInt8(max(0, min(255, Int((c.0 * 255.0).rounded()))))
            ptr[i + 1] = UInt8(max(0, min(255, Int((c.1 * 255.0).rounded()))))
            ptr[i + 2] = UInt8(max(0, min(255, Int((c.2 * 255.0).rounded()))))
            ptr[i + 3] = 255
        }
    }

    guard let image = out.makeImage() else {
        fputs("Could not create CGImage\n", stderr)
        exit(1)
    }
    return image
}

func save(_ image: CGImage, to path: String) {
    let url = URL(fileURLWithPath: path) as CFURL
    guard let dest = CGImageDestinationCreateWithURL(url, UTType.png.identifier as CFString, 1, nil) else {
        fputs("Could not create image destination \(path)\n", stderr)
        exit(1)
    }
    CGImageDestinationAddImage(dest, image, nil)
    if !CGImageDestinationFinalize(dest) {
        fputs("Failed writing \(path)\n", stderr)
        exit(1)
    }
}

try? FileManager.default.createDirectory(atPath: iconsDir, withIntermediateDirectories: true)

for size in [16, 48, 128] {
    save(render(size: size, transform: activeColor), to: "\(iconsDir)/icon\(size).png")
    save(render(size: size, transform: mutedColor), to: "\(iconsDir)/icon\(size)-off.png")
}

save(render(size: 128, transform: activeColor), to: "\(iconsDir)/grokipedia-redirect.png")
print("Generated active + muted toolbar icons in \(iconsDir)")
