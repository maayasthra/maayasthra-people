"""Builds Maayasthra-People-Guide.pdf, the three-page staff guide sent with the launch announcement.
Run with a Python that has reportlab and svglib:  python build_guide.py [out.pdf] [page-to-keep] [light]
Dark is the default (screens from ./shots/dark); add the word light for the printable version (./shots/light).
Edit the TEXT below, run it again, and send the new PDF. Screenshots are in ./shots (demo data)."""
import sys
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from svglib.svglib import svg2rlg
from reportlab.graphics import renderPDF

HERE = __file__.rsplit('/', 1)[0]
LIGHT = 'light' in sys.argv[1:]; THEME = 'light' if LIGHT else 'dark'
args = [a for a in sys.argv[1:] if a != 'light']
OUT = args[0] if len(args) > 0 else HERE + ('/Maayasthra-People-Guide-Light.pdf' if LIGHT else '/Maayasthra-People-Guide.pdf')
KEEP = int(args[1]) if len(args) > 1 else 0                  # preview helper: draw only this page
pdfmetrics.registerFont(TTFont('Ar', '/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('ArB', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))

ORANGE, WHITE = HexColor('#FE6D00'), HexColor('#FFFFFF')
if LIGHT: BG, CARD, INK, MUTED, LINE, TINT, TINT_LINE = WHITE, WHITE, HexColor('#171717'), HexColor('#525252'), HexColor('#E5E5E5'), HexColor('#FFF4EB'), HexColor('#FFCBA0')
else:     BG, CARD, INK, MUTED, LINE, TINT, TINT_LINE = HexColor('#0A0A0A'), HexColor('#171717'), HexColor('#FAFAFA'), HexColor('#A3A3A3'), HexColor('#2E2E2E'), HexColor('#26160B'), HexColor('#6B3410')
W, H = A4; M = 42; CW = W - 2 * M
URL = 'people.maayasthra.com'; PAGES = 3

# ------------------------------------------------------------------ TEXT
STEPS = [
    ('Open the portal', 'Go to ' + URL + ' on your phone or your computer. Bookmark it, or add it to your phone\'s home screen.'),
    ('Create your account', 'Choose Create account. Enter your work email and a password. We email you a link to confirm it.'),
    ('Sign in', 'Open the link, then sign in. A one-minute tour starts. After it, finish your profile: photo, phone number and emergency contact.'),
]
LEAVE_NOTICE = ('Leave: use Outlook and the portal, for now',
                'For the next few months, please request your leave in both Outlook and this portal. Later we will move to the portal alone, and we will tell you when.')
# (title, text, screenshot or None)
FEATURES = [
    ('Leave', 'Ask for leave, see your balance and follow the answer. A request that is still waiting can be withdrawn. Remember: for now, also request it in Outlook.', 'leaves.png', 'My Leaves'),
    ('News and calendar', 'Company announcements pop up until you close them. The calendar shows holidays, birthdays, work anniversaries and who is on leave.', 'calendar.png', 'Calendar'),
    ('Tasks', 'The Task app holds your own tasks. Press Start on the one you are working on, and it moves to In progress.', 'tasks.png', 'My Tasks'),
    ('Find people', 'The org chart shows who works with whom. Search finds any colleague: press the / key from anywhere.', 'org.png', 'Org chart'),
]
SMALL = [
    ('Check in and out', 'Start your day with one tap and check out when you finish. Your hours are kept for you. At check-out you send a short end-of-day report of what you worked on.'),
    ('Payslips: coming soon', 'Requesting a payslip is switched off for now. It shows greyed out in the menu, and we will tell you when it opens.'),
]
GOOD = [
    ('Greyed-out items.', 'Members, Requests and Payslips show with a lock for now. Only admins can open them. Payslips will open for everyone later.'),
    ('Forgot your password?', 'On the sign-in page choose Forgot password. We email you a 6-digit code. Type it with a new password. The code works once and expires after 10 minutes.'),
    ('Notifications.', 'The bell tells you when a task is given to you, and reminds you 30 and 15 minutes before your shift ends to send your end-of-day report.'),
    ('Phone or computer.', 'It works on both. Choose Light, Dark or match your device from the account menu at the top right.'),
    ('Stuck?', 'If it says your email is not in the staff list, or anything else goes wrong, ask an admin. Tell them the version number shown under About.'),
]
ADMIN = ('For admins and project managers',
         'Admins approve or decline leave (each request can be copied as a WhatsApp-ready message), see attendance, and answer payslip requests under Requests. '
         'Making payslips from pasted pay details (Admin > Make payslips) is for admins only. '
         'Admins and project managers also get the full task board, the team view and everyone\'s end-of-day reports.')
COMING = ('Coming next',
          'Planned, with no dates yet. We will announce each one when it is ready.',
          [('Leave in one place', 'Once the portal is settled, leave moves from Outlook to the portal alone.'),
           ('Install it like an app', 'Add it to your phone with its own icon.'),
           ('Monthly hours summary', 'See your hours for the month at a glance.'),
           ('Two-step sign-in for admins', 'An extra check at sign-in, for extra safety.')])

# ------------------------------------------------------------------ drawing helpers
# One grid for every page: 42 pt side margins, content from y = TOP down to y = BOT, a 12 pt gutter, and fixed line spacing.
TOP, BOT, GUT = H - 104, 62, 12
c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle('Maayasthra People: staff guide'); c.setAuthor('Maayasthra'); c.setSubject('Getting started with Maayasthra People')

def wrap(text, font, size, width): return simpleSplit(text, font, size, width)
def th(text, font, size, width, lead): return len(wrap(text, font, size, width)) * lead      # height of a wrapped text block

def text(x, ytop, t, font, size, color, width, lead):
    """Draws wrapped text whose first line sits in a box starting at ytop; returns the y under the last line."""
    c.setFont(font, size); c.setFillColor(color); y = ytop
    for line in wrap(t, font, size, width):
        y -= lead; c.drawString(x, y - (lead - size) / 2 + 1.5, line)   # baseline centred in its line box
    return y

def header(page):
    c.setFillColor(BG); c.rect(0, 0, W, H, fill=1, stroke=0)
    logo = svg2rlg(HERE + '/../public/' + ('maayasthra-logo-dark.svg' if LIGHT else 'maayasthra-logo.svg')); s = 118 / logo.width
    logo.width *= s; logo.height *= s; logo.scale(s, s)
    ly = H - 36 - logo.height; renderPDF.draw(logo, c, M, ly)
    c.setFont('Ar', 9); c.setFillColor(MUTED); c.drawRightString(W - M, ly + logo.height / 2 - 3, 'Staff guide  ·  page %d of %d' % (page, PAGES))
    c.setStrokeColor(ORANGE); c.setLineWidth(2); c.line(M, H - 76, W - M, H - 76)

def footer():
    c.setStrokeColor(LINE); c.setLineWidth(.6); c.line(M, 46, W - M, 46)
    c.setFont('Ar', 8.5); c.setFillColor(MUTED); c.drawString(M, 30, URL); c.drawRightString(W - M, 30, 'Maayasthra People')

def heading(y, t, size=15):
    c.setFont('ArB', size); c.setFillColor(INK); c.drawString(M, y - size, t); return y - size * 1.5

def box(x, ytop, w, h, tint=False):
    c.setFillColor(TINT if tint else CARD); c.setStrokeColor(TINT_LINE if tint else LINE); c.setLineWidth(.8)
    c.roundRect(x, ytop - h, w, h, 8, fill=1, stroke=1)

def badge(cx, cy, n):
    c.setFillColor(ORANGE); c.circle(cx, cy, 12, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont('ArB', 12); c.drawCentredString(cx, cy - 4.2, str(n))

PAD, BODY, LEAD = 14, 9.4, 13.4
import os
def shot_path(name):
    p = HERE + '/shots/' + THEME + '/' + name
    return p if os.path.exists(p) else HERE + '/shots/dark/' + name     # a theme with a missing screen falls back to the dark one
def shot(x, ytop, w, name):
    img = ImageReader(shot_path(name)); iw, ih = img.getSize(); h = w * ih / iw
    c.drawImage(img, x, ytop - h, w, h); c.setStrokeColor(LINE); c.setLineWidth(.8); c.rect(x, ytop - h, w, h, fill=0, stroke=1)
    return h
def shot_h(w, name):
    iw, ih = ImageReader(shot_path(name)).getSize(); return w * ih / iw

def cols(n, gap=GUT): return (CW - gap * (n - 1)) / n

def row_of_cards(y, items, n, body_h, draw):
    """Equal-height cards in one row; items are drawn by draw(x, ytop, w, h, item); returns the y under the row."""
    w = cols(n); h = max(body_h(w, it) for it in items)
    for k, it in enumerate(items): box(M + k * (w + GUT), y, w, h); draw(M + k * (w + GUT), y, w, h, it)
    return y - h

# ------------------------------------------------------------------ pages
def page1():
    header(1); y = TOP
    c.setFont('ArB', 27); c.setFillColor(INK); c.drawString(M, y - 27, 'Welcome to Maayasthra People'); y -= 27 + 8
    y = text(M, y, 'One place for your attendance, leave and tasks. This guide takes two minutes to read.', 'Ar', 12, MUTED, CW, 17) - 22
    y = heading(y, 'Get started in three steps') - 4
    sw = cols(3)
    def step_h(w, it): return PAD + 24 + 10 + th(it[2], 'Ar', BODY, w - 2 * PAD, LEAD) + PAD - 2
    def step(x, ytop, w, h, it):
        n, t, b = it; badge(x + PAD + 12, ytop - PAD - 12, n)
        c.setFont('ArB', 11); c.setFillColor(INK); c.drawString(x + PAD + 30, ytop - PAD - 12 - 4, t)
        text(x + PAD, ytop - PAD - 24 - 6, b, 'Ar', BODY, MUTED, w - 2 * PAD, LEAD)
    y = row_of_cards(y, [(i, t, b) for i, (t, b) in enumerate(STEPS, 1)], 3, step_h, step) - 16
    t, b = LEAVE_NOTICE; h = PAD + 15 + 6 + th(b, 'Ar', 9.8, CW - 2 * PAD - 4, 14) + PAD - 2
    box(M, y, CW, h, True); c.setFillColor(ORANGE); c.roundRect(M, y - h, 5, h, 2.5, fill=1, stroke=0)
    c.setFont('ArB', 12); c.setFillColor(INK); c.drawString(M + PAD + 4, y - PAD - 11, t)
    text(M + PAD + 4, y - PAD - 15, b, 'Ar', 9.8, MUTED, CW - 2 * PAD - 4, 14); y -= h + 22
    y = heading(y, 'Your home page') - 2
    h = shot(M, y, CW, 'home.png')
    text(M, y - h - 4, 'Your leave balances, your day, announcements and your team, all in one view. Sample data shown.', 'Ar', 8.8, MUTED, CW, 12)
    footer()

def page2():
    header(2); y = TOP
    y = heading(y, 'What you can do', 20) - 6
    w = cols(2)
    def feat_h(w, it): return PAD + shot_h(w - 2 * PAD, it[2]) + 10 + 15 + 4 + th(it[1], 'Ar', BODY, w - 2 * PAD, LEAD) + PAD - 2
    def feat(x, ytop, w, h, it):
        t, b, im, _ = it; ih = shot(x + PAD, ytop - PAD, w - 2 * PAD, im); ty = ytop - PAD - ih - 10
        c.setFont('ArB', 11.5); c.setFillColor(INK); c.drawString(x + PAD, ty - 11, t)
        text(x + PAD, ty - 15, b, 'Ar', BODY, MUTED, w - 2 * PAD, LEAD)
    def small_h(w, it): return PAD + 15 + 4 + th(it[1], 'Ar', BODY, w - 2 * PAD, LEAD) + PAD - 2
    def small(x, ytop, w, h, it):
        c.setFont('ArB', 11.5); c.setFillColor(INK); c.drawString(x + PAD, ytop - PAD - 11, it[0])
        text(x + PAD, ytop - PAD - 15, it[1], 'Ar', BODY, MUTED, w - 2 * PAD, LEAD)
    rows = [(FEATURES[0:2], feat_h, feat), (FEATURES[2:4], feat_h, feat), (SMALL, small_h, small)]
    used = sum(max(f(w, it) for it in items) for items, f, _ in rows); gap = min(22, max(GUT, (y - BOT - used) / (len(rows) - 1)))   # spread any spare room evenly
    for items, f, d in rows: y = row_of_cards(y, items, 2, f, d) - gap
    footer()

def page3():
    header(3); y = TOP
    y = heading(y, 'Good to know', 20) - 12
    # each tip: orange dot level with a bold title, then the sentence underneath, all on one left edge
    tips = [(t, b) for t, b in GOOD]
    tip_h = lambda b: 15 + th(b, 'Ar', 10, CW - 20, 14.5)
    total = sum(tip_h(b) for _, b in tips)
    for t, b in tips:
        c.setFillColor(ORANGE); c.circle(M + 4, y - 7.5, 3, fill=1, stroke=0)
        c.setFont('ArB', 10.8); c.setFillColor(INK); c.drawString(M + 20, y - 11.5, t)
        y = text(M + 20, y - 15 + 1, b, 'Ar', 10, MUTED, CW - 20, 14.5) - 17
    y -= 6
    t, b = ADMIN; h = PAD + 16 + th(b, 'Ar', 9.6, CW - 2 * PAD, 14) + PAD - 2
    box(M, y, CW, h, True); c.setFont('ArB', 12); c.setFillColor(INK); c.drawString(M + PAD, y - PAD - 11, t)
    text(M + PAD, y - PAD - 15, b, 'Ar', 9.6, MUTED, CW - 2 * PAD, 14); y -= h + 32
    t, sub, items = COMING
    y = heading(y, t, 15) + 2
    y = text(M, y, sub, 'Ar', 9.6, MUTED, CW, 14) - 14
    def soon_h(w, it): return PAD + 15 + 4 + th(it[1], 'Ar', BODY, w - 2 * PAD, LEAD) + PAD - 2
    def soon(x, ytop, w, h, it):
        c.setFont('ArB', 11); c.setFillColor(INK); c.drawString(x + PAD, ytop - PAD - 11, it[0])
        text(x + PAD, ytop - PAD - 15, it[1], 'Ar', BODY, MUTED, w - 2 * PAD, LEAD)
    y = row_of_cards(y, items[0:2], 2, soon_h, soon) - GUT
    y = row_of_cards(y, items[2:4], 2, soon_h, soon)
    footer()

if KEEP in (0, 1): page1()
if KEEP == 0: c.showPage()
if KEEP in (0, 2): page2()
if KEEP == 0: c.showPage()
if KEEP in (0, 3): page3()
c.showPage(); c.save()
print('wrote', OUT)
