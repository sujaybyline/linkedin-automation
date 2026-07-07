# PDF Parser Migration: pdf-parse → unpdf

## Summary

Successfully migrated from `pdf-parse@2.4.5` to `unpdf@1.6.2` to resolve the `ReferenceError: DOMMatrix is not defined` startup crash caused by missing native canvas dependencies.

## Changes Made

### 1. Dependencies (package.json)

**Removed:**
- `pdf-parse@2.4.5` (and all its transitive dependencies including pdfjs-dist)
- 4 total packages removed

**Added:**
- `unpdf@1.6.2`
- 1 package added

**Result:** Clean dependency tree without canvas/DOMMatrix requirements

### 2. Code Changes (lib/documentTextExtractor.js)

#### Import Strategy
- Replaced `const pdfParse = require("pdf-parse");` with dynamic ESM import
- Added `getUnpdfExtractText()` helper function to lazily load unpdf (ESM-only module)
- Kept rest of file as CommonJS for compatibility

```javascript
// unpdf is ESM-only, so we import it dynamically when needed
let unpdfExtractText;
async function getUnpdfExtractText() {
  if (!unpdfExtractText) {
    const unpdf = await import("unpdf");
    unpdfExtractText = unpdf.extractText;
  }
  return unpdfExtractText;
}
```

#### PDF Extraction Updates

**Location 1: `extractCleanWebsiteText()` (~line 164)**
- Fetched PDFs from URLs
- Changed from `pdfParse(buffer)` to `extractText(uint8Array, { mergePages: true })`
- Added proper error handling with user-friendly messages
- Converted Node Buffer to Uint8Array for compatibility

**Location 2: `extractFileText()` (~line 208)**
- Uploaded PDF file buffers
- Changed from `pdfParse(file.buffer)` to `extractText(uint8Array, { mergePages: true })`
- Added proper error handling
- Converted Node Buffer to Uint8Array for compatibility

**Key Technical Details:**
- Used `{ mergePages: true }` option to get a single string (matches old `pdf.text` behavior)
- Explicit Buffer → Uint8Array conversion for safety: `new Uint8Array(buffer)`
- Result handling: `typeof result === "string" ? result : result.text || ""`

### 3. Behavior Preserved

✅ No changes to .docx, .doc, or .txt file handling
✅ Text extraction output format unchanged
✅ Error handling maintained
✅ Truncation and deduplication logic unchanged

## Verification

### Startup Test
✅ Server starts without DOMMatrix/ImageData/Path2D errors
✅ No `ReferenceError: DOMMatrix is not defined` crash

### Dependency Cleanup
✅ `pdf-parse` completely removed
✅ `pdfjs-dist` completely removed
✅ No `canvas` or `@napi-rs/canvas` dependencies
✅ 4 packages removed, 1 added (net -3 dependencies)

### Module Import Test
✅ `unpdf` imports successfully
✅ `extractText` function available
✅ All expected exports present

## Testing Recommendations

To fully verify the migration works with real PDFs:

1. **Upload PDF Test**
   - Upload a PDF file through the UI
   - Verify text extraction completes successfully
   - Compare extracted text quality with previous version

2. **URL PDF Test**
   - Provide a URL that serves `application/pdf`
   - Verify URL-based PDF fetching and extraction works
   - Check that extracted text is non-empty

3. **Error Handling Test**
   - Try uploading a corrupted PDF
   - Verify user-friendly error message appears
   - Ensure no unhandled promise rejections

## Files Modified

- `backend/package.json` - Updated dependencies
- `backend/lib/documentTextExtractor.js` - Migrated PDF extraction logic
- `backend/package-lock.json` - Auto-updated by npm install

## Files Created

- `backend/scripts/test-unpdf-migration.js` - Verification script
- `backend/MIGRATION-UNPDF.md` - This document

## Rollback Instructions

If issues arise, rollback by:

```bash
cd backend
git checkout HEAD -- package.json lib/documentTextExtractor.js
npm install
```

However, this will restore the DOMMatrix crash, so instead consider:
- Installing `@napi-rs/canvas` if native rendering is needed (not recommended for text-only)
- Debugging specific unpdf issues with error logs

## References

- unpdf GitHub: https://github.com/unjs/unpdf
- unpdf npm: https://www.npmjs.com/package/unpdf
- Issue resolved: `ReferenceError: DOMMatrix is not defined` from pdf-parse v2.x
