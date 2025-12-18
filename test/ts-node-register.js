// Custom ts-node register that resolves .js imports to .ts files
const Module = require('module')
const path = require('path')
const fs = require('fs')

const originalResolveFilename = Module._resolveFilename

Module._resolveFilename = function (request, parent, isMain, options) {
  // If the request ends with .js and it's a relative import
  if (request.endsWith('.js') && !request.startsWith('node:') && request.startsWith('.')) {
    // Try to resolve to .ts file first
    const parentDir = path.dirname(parent.filename)
    const tsPath = path.resolve(parentDir, request.replace(/\.js$/, '.ts'))
    
    // Check if .ts file exists
    if (fs.existsSync(tsPath)) {
      const relativeTsPath = './' + path.relative(parentDir, tsPath).replace(/\\/g, '/')
      try {
        return originalResolveFilename.call(this, relativeTsPath, parent, isMain, options)
      } catch {
        // Fall through
      }
    }
  }
  
  // Fall back to original resolution
  return originalResolveFilename.call(this, request, parent, isMain, options)
}

// Now register ts-node
require('ts-node/register')

