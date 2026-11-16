"""Builds Maayasthra-People-Guide.pdf, the three-page staff guide sent with the launch announcement.
Run with a Python that has reportlab and svglib:  python build_guide.py [out.pdf] [page-to-keep]
Edit the TEXT below, run it again, and send the new PDF. Screenshots are in ./shots (demo data, light theme)."""
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
OUT = sys.argv[1] if len(sys.argv) > 1 else HERE + '/Maayasthra-People-Guide.pdf'
KEEP = int(sys.argv[2]) if len(sys.argv) > 2 else 0          # preview helper: draw only this page
pdfmetrics.registerFont(TTFont('Ar', '/System/Library/Fonts/Supplemental/Arial.ttf'))
pdfmetrics.registerFont(TTFont('ArB', '/System/Library/Fonts/Supplemental/Arial Bold.ttf'))

ORANGE, INK, MUTED, LINE, TINT, WHITE = HexColor('#FE6D00'), HexColor('#171717'), HexColor('#525252'), HexColor('#E5E5E5'), HexColor('#FFF4EB'), HexColor('#FFFFFF')
W, H = A4; M = 42; CW = W - 2 * M
URL = 'people.maayasthra.com'; PAGES = 3

# ------------------------------------------------------------------ TEXT
STEPS = [
    ('Check your inbox', 'You will get an invite email at your work address. Open it and choose a password.'),
    ('Open ' + URL, 'On your phone or your computer. Bookmark it, or add it to your phone\'s home screen.'),
    ('Take the one-minute tour', 'It starts the first time you sign in. Then finish your profile: a photo, a line about you, your phone number and an emergency contact.'),
]
LEAVE_NOTICE = ('Leave: use Outlook and the portal, for now',
                'For the next few months, please request your leave in both Outlook and this portal. Later we will move to the portal alone, and we will tell you when.')
# (title, text, screenshot or None)
FEATURES = [
    ('Leave', 'Ask for leave, see your balance and follow the answer. A request that is still waiting can be withdrawn. Remember: for now, also request it in Outlook.', 'leaves.png', 'My Leaves'),
    ('Request a payslip', 'Ask for the payslip of a past month. An admin prepares it, you are told when it is ready, and you download it from the Payslips page.', 'payslips.png', 'Payslips'),
    ('News and calendar', 'Company announcements pop up until you close them. The calendar shows holidays, birthdays, work anniversaries and who is on leave.', 'calendar.png', 'Calendar'),
    ('Tasks', 'The Task app holds your own tasks. Press Start on the one you are working on, and it moves to In progress.', 'tasks.png', 'My Tasks'),
]
SMALL = [
    ('Check in and out', 'Start your day with one tap and check out when you finish. Your hours are kept for you. At check-out you send a short end-of-day report of what you worked on.'),
    ('Find people', 'The org chart shows who works with whom. Search finds any colleague: press the / key from anywhere.'),
]
GOOD = [
    ('Your payslip is private.', 'Only you and the admins who issue payslips can open it. Once you download a payslip, the file is removed from our servers, so save your copy.'),
    ('Forgot your password?', 'On the sign-in page choose Forgot password. We email you a 6-digit code. Type it with a new password. The code works once and expires after 10 minutes.'),
    ('Notifications.', 'The bell tells you when a task is given to you, and reminds you 30 and 15 minutes before your shift ends to send your end-of-day report.'),
    ('Phone or computer.', 'It works on both. Choose Light, Dark or match your device from the account menu at the top right.'),
    ('Stuck?', 'Ask an admin, and tell them the version number shown under About.'),
]
ADMIN = ('For admins and project managers',
         'Admins approve or decline leave (each request can be copied as a WhatsApp-ready message), see attendance, and answer payslip requests under Requests. '
         'Making payslips from pasted pay details (Admin > Make payslips) is for admins only. '
         'Admins and project managers also get the full task board, the team view and everyone\'s end-of-day reports.')
COMING = ('Coming next',
          'Planned, with no dates yet. We will announce each one when it is ready.',
          ['Leave in one place. Once the portal is settled, leave moves from Outlook to the portal alone.',
           'Install it like an app on your phone, with its own icon.',
           'A monthly summary of your hours.',
           'Two-step sign-in for admins, for extra safety.'])

# ------------------------------------------------------------------ drawing helpers
c = canvas.Canvas(OUT, pagesize=A4)
c.setTitle('Maayasthra People: staff guide'); c.setAuthor('Maayasthra'); c.setSubject('Getting started with Maayasthra People')

def lines_of(text, font, size, width): return simpleSplit(text, font, size, width)
def height(text, font, size, width, lead=None): return len(lines_of(text, font, size, width)) * (lead or size * 1.42)

def para(x, y, text, font='Ar', size=10, color=MUTED, width=CW, lead=None):
    """Wrapped text from the top edge y downward; returns the y below it."""
    lead = lead or size * 1.42
    c.setFont(font, size); c.setFillColor(color)
    for line in lines_of(text, font, size, width):
        y -= lead; c.drawString(x, y, line)
    return y

def bullet(x, y, lead_in, text, width, size=10.5, lead=15):
    """A bullet with a bold lead-in, wrapped as one paragraph; returns the y below it."""
    c.setFillColor(ORANGE); c.circle(x + 4, y - 11, 3, fill=1, stroke=0)
    words = (lead_in + ' ' + text).strip().split(' '); n_lead = len(lead_in.split(' ')) if lead_in else 0
    rows, cur, curw = [], [], 0
    for k, wd in enumerate(words):
        f = 'ArB' if k < n_lead else 'Ar'; ww = pdfmetrics.stringWidth(wd + ' ', f, size)
        if curw + ww > width - 20 and cur: rows.append(cur); cur, curw = [], 0
        cur.append((wd, f)); curw += ww
    rows.append(cur); yy = y - 14
    for row in rows:
        xx = x + 20
        for wd, f in row:
            c.setFont(f, size); c.setFillColor(INK if f == 'ArB' else MUTED); c.drawString(xx, yy, wd); xx += pdfmetrics.stringWidth(wd + ' ', f, size)
        yy -= lead
    return yy - 6

def header(page):
    logo = svg2rlg(HERE + '/../public/maayasthra-logo-dark.svg'); s = 118 / logo.width
    logo.width *= s; logo.height *= s; logo.scale(s, s)
    renderPDF.draw(logo, c, M, H - 40 - logo.height)
    c.setFont('Ar', 9); c.setFillColor(MUTED); c.drawRightString(W - M, H - 52, 'Staff guide  ·  page %d of %d' % (page, PAGES))
    c.setStrokeColor(ORANGE); c.setLineWidth(2.2); c.line(M, H - 76, W - M, H - 76)

def footer():
    c.setFont('Ar', 8.5); c.setFillColor(MUTED); c.drawString(M, 28, URL); c.drawRightString(W - M, 28, 'Maayasthra People')

def box(x, ytop, w, h, tint=False):
    c.setFillColor(TINT if tint else WHITE); c.setStrokeColor(HexColor('#FFCBA0') if tint else LINE); c.setLineWidth(.8)
    c.roundRect(x, ytop - h, w, h, 8, fill=1, stroke=1)

def notice(ytop, title, body, size=9.8):
    pad = 14; h = pad + 15 + 5 + height(body, 'Ar', size, CW - 2 * pad) + pad - 4
    box(M, ytop, CW, h, tint=True)
    c.setFillColor(ORANGE); c.roundRect(M, ytop - h, 5, h, 2.5, fill=1, stroke=0)
    c.setFont('ArB', 12); c.setFillColor(INK); c.drawString(M + pad + 2, ytop - pad - 10, title)
    para(M + pad + 2, ytop - pad - 14, body, 'Ar', size, MUTED, CW - 2 * pad - 2)
    return h

def shot(x, ytop, w, name):
    img = ImageReader(HERE + '/shots/' + name); iw, ih = img.getSize(); h = w * ih / iw
    c.drawImage(img, x, ytop - h, w, h)
    c.setStrokeColor(LINE); c.setLineWidth(.8); c.rect(x, ytop - h, w, h, fill=0, stroke=1)
    return h

def feature_card(x, ytop, w, title, body, img, h):
    pad = 12; box(x, ytop, w, h)
    ih = shot(x + pad, ytop - pad, w - 2 * pad, img)
    ty = ytop - pad - ih - 8
    c.setFont('ArB', 11.5); c.setFillColor(INK); c.drawString(x + pad, ty - 11, title)
    para(x + pad, ty - 14, body, 'Ar', 9.2, MUTED, w - 2 * pad)

def feature_h(w, body, img):
    pad = 12; iw, ih = ImageReader(HERE + '/shots/' + img).getSize()
    return pad + (w - 2 * pad) * ih / iw + 8 + 14 + 4 + height(body, 'Ar', 9.2, w - 2 * pad) + pad - 2

def small_card(x, ytop, w, title, body, h):
    pad = 12; box(x, ytop, w, h)
    c.setFont('ArB', 11.5); c.setFillColor(INK); c.drawString(x + pad, ytop - pad - 10, title)
    para(x + pad, ytop - pad - 14, body, 'Ar', 9.2, MUTED, w - 2 * pad)

def small_h(w, body): return 12 + 14 + 4 + height(body, 'Ar', 9.2, w - 24) + 10

# ------------------------------------------------------------------ pages
def page1():
    header(1)
    y = H - 112
    c.setFont('ArB', 27); c.setFillColor(INK); c.drawString(M, y - 22, 'Welcome to Maayasthra People')
    y = para(M, y - 30, 'One place for your attendance, leave, tasks and payslips. This guide takes two minutes to read.', 'Ar', 12, MUTED, CW, 17) - 8
    c.setFont('ArB', 13.5); c.setFillColor(INK); c.drawString(M, y - 18, 'Get started in three steps'); y -= 28
    for i, (t, b) in enumerate(STEPS, 1):
        bh = height(b, 'Ar', 9.8, CW - 46)
        c.setFillColor(ORANGE); c.circle(M + 13, y - 14, 12.5, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont('ArB', 12); c.drawCentredString(M + 13, y - 18, str(i))
        c.setFont('ArB', 11.5); c.setFillColor(INK); c.drawString(M + 38, y - 12, t)
        para(M + 38, y - 14, b, 'Ar', 9.8, MUTED, CW - 46)
        y -= 14 + 8 + bh + 8
    y -= 4
    y -= notice(y, *LEAVE_NOTICE) + 14
    c.setFont('ArB', 13.5); c.setFillColor(INK); c.drawString(M, y - 16, 'Your home page'); y -= 24
    h = shot(M, y, CW, 'home.png')
    para(M, y - h - 2, 'Your leave balances, your day, announcements and your team, all in one view. Sample data shown.', 'Ar', 8.8, MUTED, CW)
    footer()

def page2():
    header(2)
    y = H - 112
    c.setFont('ArB', 20); c.setFillColor(INK); c.drawString(M, y - 14, 'What you can do'); y -= 34
    gap = 12; w = (CW - gap) / 2
    for i in range(0, len(FEATURES), 2):
        pair = FEATURES[i:i + 2]; hmax = max(feature_h(w, b, im) for _, b, im, _ in pair)
        for k, (t, b, im, _) in enumerate(pair): feature_card(M + k * (w + gap), y, w, t, b, im, hmax)
        y -= hmax + gap
    hmax = max(small_h(w, b) for _, b in SMALL)
    for k, (t, b) in enumerate(SMALL): small_card(M + k * (w + gap), y, w, t, b, hmax)
    footer()

def page3():
    header(3)
    y = H - 112
    c.setFont('ArB', 20); c.setFillColor(INK); c.drawString(M, y - 14, 'Good to know'); y -= 34
    for t, b in GOOD: y = bullet(M, y, t, b, CW) - 2
    y -= 8
    t, b = ADMIN; pad = 14; h = pad + 18 + height(b, 'Ar', 9.6, CW - 2 * pad) + pad - 4
    box(M, y, CW, h, tint=True); c.setFont('ArB', 12.5); c.setFillColor(INK); c.drawString(M + pad, y - pad - 10, t)
    para(M + pad, y - pad - 16, b, 'Ar', 9.6, MUTED, CW - 2 * pad); y -= h + 16
    t, sub, items = COMING
    c.setFont('ArB', 16); c.setFillColor(INK); c.drawString(M, y - 16, t); y -= 22
    y = para(M, y - 2, sub, 'Ar', 9.6, MUTED, CW) - 6
    for it in items: y = bullet(M, y, '', it, CW, 10.2, 14.5)
    footer()

if KEEP in (0, 1): page1()
if KEEP == 0: c.showPage()
if KEEP in (0, 2): page2()
if KEEP == 0: c.showPage()
if KEEP in (0, 3): page3()
c.showPage(); c.save()
print('wrote', OUT)
