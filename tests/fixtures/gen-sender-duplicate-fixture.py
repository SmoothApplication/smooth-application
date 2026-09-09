#!/usr/bin/env python3
# Regenerates tests/fixtures/sender-duplicate-fixture.pdf. Requires `pip install reportlab`.
# Keep this in sync with the assertions in tests/sender-duplicate-prompt.test.js — if a narration
# line here changes, the matching regex(es) in that test need the same change.
#
# History: the third sender's narration originally trailed with "ONB" (simulating an unidentified
# bank-code fragment stuck onto a name) to exercise the "ask, don't auto-merge" duplicate-sender
# flow against "TUNDE BASSEY EKPO". Once "ONB" was later added to BANK_NARRATION_STOPWORDS (a real,
# separately-reported bug fix — see BANK_NARRATION_GLOSSARY in index.html), it started being
# stripped out of every narration, including this one, so "BASSEY EKPO ONB" reduced to "BASSEY EKPO"
# - a plain substring of "TUNDE BASSEY EKPO" - which then silently auto-merged via mergeNameVariants
# instead of ever reaching the ask-the-user prompt this test exists to check. Replaced with "ADISA",
# a plain extra name-word that isn't a stopword and doesn't create a substring relationship either
# way, so the two rows still genuinely require asking rather than auto-resolving.
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, A4
import os

OUT = os.path.join(os.path.dirname(__file__), 'sender-duplicate-fixture.pdf')

LINES = [
    "PERSONAL BANK STATEMENT",
    "Account Name: Test Applicant Okafor",
    "03/01/2026 NIP/TUNDE BASSEY EKPO/CASH EXCHANGE/REF301 0.00 45000.00 45000.00",
    "07/01/2026 NIP/CHIDI OGBONNA TRADERS/CASH EXCHANGE/REF401 0.00 60000.00 105000.00",
    "12/02/2026 NIP/TUNDE BASSEY EKPO/CASH EXCHANGE/REF302 0.00 45000.00 150000.00",
    "18/02/2026 NIP/CHIDI OGBONNA TRADERS/CASH EXCHANGE/REF402 0.00 60000.00 210000.00",
    "05/03/2026 NIP/BASSEY EKPO ADISA/CASH EXCHANGE/REF303 0.00 45000.00 255000.00",
    "09/04/2026 NIP/BASSEY EKPO ADISA/CASH EXCHANGE/REF304 0.00 45000.00 300000.00",
    "14/05/2026 NIP/BASSEY EKPO ADISA/CASH EXCHANGE/REF305 0.00 45000.00 345000.00",
]

def main():
    c = canvas.Canvas(OUT, pagesize=landscape(A4))
    width, height = landscape(A4)
    c.setFont("Helvetica", 10)
    y = height - 50
    for line in LINES:
        c.drawString(50, y, line)
        y -= 20
    c.showPage()
    c.save()
    print("Wrote " + OUT)

if __name__ == '__main__':
    main()
