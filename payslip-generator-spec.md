# Payslip Generator: Functional Specification

Build a single-page browser tool that turns pasted plain-text pay details into A4 payslip PDFs. Everything runs client-side; there is no backend and no stored data.

## 1. What the user does

1. Pastes pay details into a text box (one block per employee).
2. The page parses the text live (250 ms debounce) and creates one payslip per month line.
3. The user checks each payslip in a list, corrects any field, and sees a live A4 preview.
4. The user downloads one payslip as a PDF, or all of them as a single ZIP.

## 2. Page layout

- Title: "Maayasthra payslips from pasted details", with a one-line instruction below it.
- Two columns (left 320–430 px, right fills the rest); they stack into one column under 860 px wide.
- **Left column**
  - Panel "Pay details": a monospace textarea, pre-filled with sample input.
  - Panel "Payslips": a count line ("9 payslips for 2 employees, 1 to check"), a primary button "Download all (ZIP)", a status message line, the list of payslip cards, and a collapsible "N lines not used" section.
- **Right column**: sticky A4 preview of the selected payslip, scaled to fit the column (max scale 1.4). Empty state: "Paste pay details to see the payslips here."
- Supports light and dark theme for the UI. The payslip paper itself is always white.

## 3. Input format

One block per employee. Blank lines are ignored.

```
Employee Name - Designation - 27/01/26 (Joining date)

May - 30k
Jun - 35k (base pay change)
Jul - 35k
Nov - 5833 (Last working day - 06/11/26, 2days off, 1day LOP )

Second Employee - UI/UX Designer - 05/10/26 (joining date)

Oct - 35200 (Started probation at 42k on 5/10, revised to 30k from 28/10, (42/30*23)+(30/30*3)=(32200+3000)=35200)
Nov - 10000 (Last working day - 10/11/26)
```

### Header line
`Name - Designation - Date`, separated by a hyphen, en dash or em dash with spaces around it. The date is day/month/year, with `/`, `-` or `.` as separator, and a 2- or 4-digit year (2-digit years mean 20xx). Text after the date is ignored. The date must be a real calendar date.

### Month line
`Mon[ Year] - Amount[k] [note]`

- Month: any word starting with a 3-letter month abbreviation (Jan, June, Sept.), case-insensitive.
- Optional year (2 or 4 digits) after the month.
- Separator: `-`, en dash, em dash or `:`.
- Amount: optional `₹` or `Rs`, digits with optional commas and decimals, optional `k` suffix meaning ×1000 (`35k` = 35,000).
- Everything after the amount is the note.

### Year inference when the month line has no year
- First month line of an employee: the joining year; if that month is earlier in the year than the joining month, use the next year.
- Later lines: the same year as the previous line; if the month number is lower than the previous one, roll over to the next year.

### Lines that are rejected (listed under "lines not used" with a reason, never dropped silently)
- A month line before any employee header: "month line before any employee".
- A month before the joining month: "month is before the joining date".
- A repeated month for the same employee: "this month is already listed for <name>".
- Anything else: "not a header or month line".

## 4. What is read from the note

| Pattern in note | Meaning |
|---|---|
| `Last working day - DD/MM/YY` | Last working day. Used only if it falls in that payslip's month. |
| `N day(s) LOP` (e.g. `1day LOP`, `2.5 days LOP`) | Loss-of-pay days. |
| `(A/D*N)` groups, e.g. `(42/30*23)+(30/30*3)` | Formula terms. Paid days = sum of all N values (here 26). |

## 5. Calculations

All money is handled in paise (integers) to avoid rounding errors.

**Paid days**
- If the note has formula terms: paid days = sum of the N values. Basis text: "Paid days taken from the formula in the note".
- Otherwise: `paid = endDay - startDay + 1 - LOP`
  - `startDay` = joining day if the employee joined in this month, else 1.
  - `endDay` = last working day if set, else the number of days in the month.
- If the result is zero or negative: set to 0 and flag "Paid days came out as zero. Check the details."

**Basis text and flags** (shown on each card)
- Last working day present: "Last working day DD-MM-YYYY" plus ", N LOP" if any.
- Joined mid-month, no formula: "Joined mid-month. Confirm the paid days." and flag the card.
- Otherwise: "Full month" or "Full month minus N LOP".

**Pay date** defaults to the last day of the month.

**Monthly salary (for the Loss of Pay line)**
A month is *prorated* if paid days are fewer than the days in the month, or LOP > 0. For a prorated month with no formula terms, find the full monthly salary S. The monthly salary is always divided over **30 days**.

1. Take the amount of the nearest earlier non-prorated month of the same employee.
2. Accept S only if `S / 30 × paidDays` is within ₹1 of the amount paid.
3. If that fails, estimate `S = round(amount / paidDays × 30 / 100) × 100` (nearest ₹100) and apply the same check.
4. If still not valid, leave salary blank, flag the card, and append: "Monthly salary not confirmed, so there is no Loss of Pay line. Enter it below."

Months with formula terms and full months get no salary value, so their payslip shows only Basic Pay.

**Worked examples**
- `Nov - 5833`, last working day 06/11, 1 day LOP, previous full month 35,000: paid days = 6 − 1 + 1 − 1 = 5; 35,000 / 30 × 5 = 5,833.33 (within ₹1), so salary = 35,000 and Loss of Pay = 35,000 − 5,833 = 29,167.
- `Nov - 10000`, last working day 10/11, no earlier full month: paid days = 10; S = 10,000 / 10 × 30 = 30,000, so Loss of Pay = 20,000.
- `Oct - 35200` with `(42/30*23)+(30/30*3)`: paid days = 26, no salary, no Loss of Pay line.

## 6. Payslip card (one per month line)

- Header button: employee name, "Mon YYYY · Designation", and a chip: "Ready" (green) or "Check" (amber, when flagged). Clicking selects the card and shows it in the preview; on narrow screens the page scrolls to the preview.
- Editable fields:
  - Monthly salary (₹), step 0.01
  - Amount paid (₹), step 0.01
  - Paid days, step 0.5
  - LOP days, step 0.5
  - Last working day (date; printed on the payslip only if set)
  - Pay date (date)
- Footer: the basis text and a "Download PDF" button.
- Edits update the preview immediately. Edits are kept as overrides keyed by `employee name (lowercase) | YYYY-MM`, so they survive re-parsing when the pasted text changes.
- A payslip is valid (downloadable) when amount > 0, paid days ≥ 0 and the pay date is a valid date. "Download all" is enabled only when every payslip is valid.

## 7. Payslip document

A4 portrait, 595 × 842 pt, white, Helvetica/Arial, tight letter spacing (−0.03 em).

Top to bottom:

1. **Header band**: full width, 89 pt high, black with a background texture; company logo at left (172 × 32), the word "Payslip" in white bold 22 pt at right.
2. Large faint watermark graphic behind the body; smaller watermark graphic bottom right.
3. **Content block** (left 35, top 122, width 526, 28 pt between sections):
   - Title, 20 pt medium: `Payslip for the Month of <Month>, <Year>`
   - 14 pt grey: `Employee Net Pay : ₹<amount>` (amount bold black)
   - 12 pt grey: `Paid Days : <n> | LOP Days : <n>`
   - Thin rule
   - Heading "EMPLOYEE PAY SUMMARY" (12 pt, uppercase), then a label : value table at 10 pt:
     - Employee Name
     - Designation
     - Date of Joining (DD-MM-YYYY)
     - Last Working Day (DD-MM-YYYY; only if set)
     - Pay Period (`<Month> <Year>`)
     - Pay Date (DD-MM-YYYY)
   - Thin rule
   - Row "DESCRIPTION" / "AMOUNT"
   - Row `Basic Pay` / `₹ <monthly salary if it exceeds the amount paid, otherwise the amount paid>`
   - Row `Loss of Pay` / `-₹ <salary − amount paid>` (only when salary > amount paid)
   - Thin rule
   - Row "GROSS EARNINGS" / `₹ <amount paid>`
   - 12 pt grey, two lines: `Total Net Payable ₹<amount>` and `(<amount in words>)`
4. **Footer**: short grey rule at left (top 787, width 292) and the text `- This is a system generated payslip -` (10 pt).

No tax, PF or other deduction lines exist; net pay = gross earnings = amount paid.

## 8. Number formatting

- Currency: Indian digit grouping with two decimals: `1,23,456.00`.
- Amount in words: Indian system (Crore, Lakh, Thousand, Hundred), in the form `Rupees Thirty Five Thousand Only.` With paise: `Rupees Five Thousand and Fifty Paise Only.`
- Dates on the payslip: DD-MM-YYYY.
- Paid/LOP days: plain numbers, no trailing zeros (`5`, `2.5`).

## 9. Export

- **Single PDF**: render the payslip markup off-screen at 595 × 842, rasterise at 3× scale, and place it as a full-page image in an A4 PDF (pt units, compressed). PDF title: `Payslip - <Name> - <Mon YYYY>`.
- **File name**: `<Name> - <Month> Payslip <Year> - Maayasthra.pdf`. Characters `\ / : * ? " < > |` in the name are replaced with spaces.
- **Download all**: generate every PDF in order, with progress text "Creating payslip 3 of 9…", and pack them into `Payslips.zip` (stored, no compression). Duplicate file names get `_2`, `_3` suffixes.
- Status messages: "Preparing <name>, <month>…", "Saved <file>", "Download cancelled.", and an error message if PDF tools fail to load.
- Buttons are disabled while an export is running.

## 10. Implementation notes

- Current build: one HTML file, vanilla JavaScript, html2canvas 1.4.1 for rasterising and jsPDF 2.5.1 for the PDF, plus a small hand-written ZIP writer. Inter font for the UI.
- Brand assets (logo SVG, header texture PNG, two watermark images) are embedded as data URIs; supply your own when rebuilding.
- The same payslip markup function is used for both the preview and the PDF, so they always match.
- All user text is HTML-escaped before rendering.
