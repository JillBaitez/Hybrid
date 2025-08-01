#!/bin/bash

echo "Building HTOS extension..."

# Clean previous build
echo "📦 Cleaning dist..."
rm -rf dist
mkdir -p dist/{core,host,pow,storage,rules,session-layer}

# Compile TypeScript
echo "🔧 Compiling TypeScript..."
npx tsc --build

# Copy all assets
echo "📋 Copying assets..."
cp rules/*.json dist/rules/
cp *.html dist/
cp *.js dist/
cp manifest.json dist/
cp src/host/*.html dist/host/
cp src/pow/*.html dist/pow/
cp src/session-layer/* dist/session-layer/

# Validate JSON rules
echo "✅ Validating rules..."
for rule in dist/rules/*.json; do
    jq empty "$rule" || { echo "❌ Invalid JSON: $rule"; exit 1; }
done

# Set permissions
chmod -R 644 dist/*

echo "✨ Build complete! Files ready in dist/"
