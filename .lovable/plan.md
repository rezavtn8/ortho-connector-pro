

# Fix Letter Campaign: Doctor Name Fallback & PDF Fidelity

## Problem 1: "Dear Dr. Doctor!" when no contact exists

The `extractDoctorName` function falls back to `'Doctor'`, then the salutation does `Dear Dr. Doctor` — doubling up. The logic also naively takes the last word of the office name as a surname.

### Fix in `LetterExecutionDialog.tsx`

**Update `extractDoctorName`** to return a structured result `{ displayName, salutation }` instead of a single string:
- If `primary_contact` exists: use it for both (e.g., display "Dr. Smith", salutation "Dr. Smith")
- If office name contains "Dr. X": extract and use that
- If neither: `displayName = office name`, `salutation = null` (meaning use "Dear Friends at [Office Name]," instead of "Dear Dr. Doctor,")

**Update the salutation line** (line 573-575) to use the structured result — if no doctor name is available, render `"Dear Friends at {office.name},"` instead of `"Dear Dr. Doctor,"`.

**Update the PDF export** salutation (line 341-344) with the same logic.

**Update `generateLetters`** merge (line 226-231): when replacing `{{doctor_name}}`, use the display name; also replace a new `{{salutation}}` placeholder or just fix the hardcoded "Dear Dr." in the template prompt to handle the no-name case.

## Problem 2: PDF doesn't match the preview

The PDF uses jsPDF's built-in `helvetica` font (the only font available by default), ignoring the user's selected `style.fontFamily`. The logo is rendered as a small 60x60 image vs the preview's styled version. Layout spacing differs.

### Fix: Use `html2canvas` to capture the preview exactly

Replace the manual jsPDF text-drawing approach with an `html2canvas`-based capture of each letter's styled preview div. This guarantees font, color, logo, and spacing fidelity.

**Changes to `exportPdf`:**
1. Add `html2canvas` (already available or add as dependency)
2. For each delivery:
   - Render the letter into a hidden off-screen div with the exact same styles as the preview (reuse the preview JSX)
   - Capture with `html2canvas` at `scale: 2` and `useCORS: true`
   - Add the canvas as an image to jsPDF at letter-size dimensions
3. Remove the manual text-drawing code (lines 278-371)

Actually, since `html2canvas` would be a new dependency and adds complexity, a simpler approach: **use jsPDF's font embedding** to match the preview font, and replicate the preview layout more faithfully.

**Simpler approach — fix the PDF to closely match:**
1. For fonts: jsPDF only supports `helvetica`, `times`, `courier` natively. Map `style.fontFamily` to the closest jsPDF font:
   - Georgia/Times New Roman/Garamond/Palatino → `times`
   - System Sans/Segoe UI → `helvetica`
2. Use `style.headingColor` for the clinic name in PDF (already done but verify hex format)
3. Fix logo sizing: match the preview's `w-14 h-14` (56px = ~42pt) proportionally
4. Use `style.fontSize` consistently (already done for body but ensure heading/date/address use the same relative sizes as preview: heading 1.3em, date 0.85em, etc.)
5. Match line spacing to preview's `lineHeight: 1.6`

### Implementation summary for PDF fix:
- Add font mapping function: `getJsPDFFont(fontFamily) → 'times' | 'helvetica' | 'courier'`
- Apply mapped font throughout the PDF generation instead of hardcoded `'helvetica'`
- Fix logo dimensions to match preview proportions
- Use relative font sizes matching the preview CSS (heading = fontSize * 1.3, date = fontSize * 0.85, etc.)

## Files to modify
- `src/components/campaign/LetterExecutionDialog.tsx` — both fixes

