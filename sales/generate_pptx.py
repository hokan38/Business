#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
MarkGate 人材紹介エージェント様向けご案内資料 — PowerPoint(.pptx) 生成スクリプト

16:9・エディトリアルデザイン（ウォームブラック × クリーム × ゴールド）。
図解・数値中心の全17スライドを、編集可能なネイティブPPTXとして生成します。
この PPTX が営業資料の「正」です。

使い方:
    pip install python-pptx
    python3 sales/generate_pptx.py [出力パス.pptx]
"""
import sys

from pptx import Presentation
from pptx.util import Mm, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn

# ---------- キャンバス（16:9） ----------
W, H = 338.6, 190.5          # mm
MX = 20.5                    # 左右マージン
CW = W - MX * 2              # コンテンツ幅 ≒ 297.6

# ---------- 配色 ----------
DARK = RGBColor.from_string("131009")     # ウォームブラック（背景・パネル）
DARK2 = RGBColor.from_string("1A1610")    # ダーク面のカード
CREAM = RGBColor.from_string("F4F1E9")    # クリーム背景
CREAM2 = RGBColor.from_string("EBE5D8")   # クリーム面のカード
CREAM3 = RGBColor.from_string("E7E1D2")   # 表ヘッダー
INK = RGBColor.from_string("201C15")      # 本文（濃）
GRAY = RGBColor.from_string("8F8A7B")     # リード文・注釈（クリーム面）
GRAY_D = RGBColor.from_string("ABA595")   # 本文（ダーク面）
GRAY_D2 = RGBColor.from_string("7E7868")  # 注釈（ダーク面）
GOLD = RGBColor.from_string("B8934E")     # ゴールド（罫線・強調）
GOLD_T = RGBColor.from_string("8A6A32")   # ゴールド（クリーム面の小さい文字）
GOLD_L = RGBColor.from_string("D8C08C")   # ゴールド（ダーク面の文字）
RED = RGBColor.from_string("A03A2A")      # ネガティブ強調
WHITE = RGBColor.from_string("FFFFFF")

SERIF_LAT, SERIF_EA = "Garamond", "游明朝"
SANS_LAT, SANS_EA = "Yu Gothic", "游ゴシック"

FONT_SCALE = 1.0  # 全体の文字サイズ倍率


def _set_fonts(run, serif=False):
    run.font.name = SERIF_LAT if serif else SANS_LAT
    rPr = run._r.get_or_add_rPr()
    ea = rPr.find(qn("a:ea"))
    if ea is None:
        ea = rPr.makeelement(qn("a:ea"), {})
        latin = rPr.find(qn("a:latin"))
        (latin.addnext(ea) if latin is not None else rPr.append(ea))
    ea.set("typeface", SERIF_EA if serif else SANS_EA)


def _style_run(run, text, size=9.5, color=INK, bold=False, serif=False,
               italic=False, spc=None):
    run.text = text
    run.font.size = Pt(round(size * FONT_SCALE, 1))
    run.font.color.rgb = color
    run.font.bold = bold
    run.font.italic = italic
    _set_fonts(run, serif=serif)
    if spc:
        run._r.get_or_add_rPr().set("spc", str(int(spc * 100)))


def t(text, **kw):
    return (text, kw)


def text_box(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP):
    tb = slide.shapes.add_textbox(Mm(x), Mm(y), Mm(w), Mm(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, 0)
    for i, (runs, opts) in enumerate(paras):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = opts.get("align", PP_ALIGN.LEFT)
        p.line_spacing = opts.get("spacing", 1.3)
        if opts.get("after"):
            p.space_after = Pt(opts["after"])
        if opts.get("before"):
            p.space_before = Pt(opts["before"])
        for text, st in runs:
            _style_run(p.add_run(), text, **st)
    return tb


def rect(slide, x, y, w, h, fill=None, line=None, line_w=0.75):
    sp = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, Mm(x), Mm(y), Mm(w), Mm(h))
    if fill is None:
        sp.fill.background()
    else:
        sp.fill.solid()
        sp.fill.fore_color.rgb = fill
    if line is None:
        sp.line.fill.background()
    else:
        sp.line.color.rgb = line
        sp.line.width = Pt(line_w)
    sp.shadow.inherit = False
    return sp


def hline(slide, x, y, w, color=GOLD, th=0.35):
    rect(slide, x, y, w, th, fill=color)


def add_slide(prs, dark=False):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, H, fill=(DARK if dark else CREAM))
    return s


def sec_label(slide, text, dark=False):
    """左上のセクションラベル（例: 01 / EXECUTIVE SUMMARY）＋短い金罫"""
    text_box(slide, MX, 14.5, 200, 7, [
        ([t(text, size=10.5, color=(GOLD_L if dark else GOLD_T),
            serif=True, italic=True, spc=2.5)], {}),
    ])
    hline(slide, MX, 22.8, 11.5, color=GOLD, th=0.6)


def big_title(slide, runs_lines, y=28, size=29, dark=False):
    paras = []
    for runs in runs_lines:
        styled = []
        for text, kw in runs:
            st = dict(size=size, bold=True, serif=True,
                      color=kw.get("color", WHITE if dark else INK), spc=1)
            st.update(kw)
            st.setdefault("size", size)
            styled.append((text, st))
        paras.append((styled, dict(spacing=1.25)))
    text_box(slide, MX, y, CW, 16 * len(runs_lines), paras)
    return y + 15.5 * len(runs_lines)


def lead(slide, text, y, dark=False):
    text_box(slide, MX, y, CW, 9, [
        ([t(text, size=10.5, color=(GRAY_D if dark else GRAY), spc=1)],
         dict(spacing=1.4)),
    ])
    return y + 10


def band(slide, runs, y=163.5):
    """下部の黒帯メッセージ"""
    rect(slide, MX, y, CW, 12.5, fill=DARK)
    text_box(slide, MX + 8, y, CW - 16, 12.5,
             [(runs, dict(align=PP_ALIGN.CENTER))], anchor=MSO_ANCHOR.MIDDLE)


def src_note(slide, text, y=180):
    text_box(slide, MX, y, CW, 6, [
        ([t(text, size=7, color=GRAY)], {}),
    ])


def col_item(slide, x, y, w, num, head, body, dark=False, rule=GOLD,
             eng=None, head_size=12.5):
    """金罫＋斜体番号＋見出し＋短文 の縦コラム"""
    hline(slide, x, y, w, color=rule, th=0.4)
    yy = y + 4
    if num:
        text_box(slide, x, yy, w, 9, [
            ([t(num, size=15, color=(GOLD_L if dark else GOLD_T),
                serif=True, italic=True)], {}),
        ])
        yy += 10.5
    head_runs = [t(head, size=head_size, bold=True,
                   color=(WHITE if dark else INK))]
    if eng:
        head_runs = [head_runs[0]]
    text_box(slide, x, yy, w, 8, [(head_runs, {})])
    yy += 7.5
    if eng:
        text_box(slide, x, yy, w, 5, [
            ([t(eng, size=6.8, color=(GRAY_D2 if dark else GRAY), spc=2)], {}),
        ])
        yy += 6
    text_box(slide, x, yy + 0.5, w, 24, [
        ([t(body, size=9.3, color=(GRAY_D if dark else INK))],
         dict(spacing=1.45)),
    ])


# ============================================================
def build(out_path):
    prs = Presentation()
    prs.slide_width = Mm(W)
    prs.slide_height = Mm(H)

    # ================= P.01 表紙（ダーク） =================
    s = add_slide(prs, dark=True)
    hline(s, MX, 15, CW, color=GOLD, th=0.35)
    hline(s, MX, 167, CW, color=GOLD, th=0.35)
    text_box(s, MX, 40, 250, 8, [
        ([t("人材紹介エージェント様向け ご案内資料", size=11, color=GOLD_L, spc=4)], {}),
    ])
    text_box(s, MX, 51, 300, 32, [
        ([t("MarkGate", size=56, color=WHITE, serif=True),
          t(".", size=56, color=GOLD, serif=True)], {}),
    ])
    text_box(s, MX, 92, 300, 12, [
        ([t("絞るから、届く。スカウトと指名のハイクラス転職。",
            size=17.5, color=WHITE, serif=True, bold=True, spc=2)], {}),
    ])
    text_box(s, MX, 112, 300, 16, [
        ([t("「量の競争」で飽和した転職スカウト市場を、送り手を絞る「質の競争」へ。",
            size=9.5, color=GRAY_D, spc=1)], dict(spacing=1.6)),
        ([t("実績トップクラスのキャリアアドバイザーだけが参加できる、品質保証型マッチングプラットフォーム。",
            size=9.5, color=GRAY_D, spc=1)], dict(spacing=1.6)),
    ])
    text_box(s, MX, 172, 150, 6, [
        ([t("CONFIDENTIAL　·　2026", size=8, color=GRAY_D2, spc=3)], {}),
    ])
    text_box(s, W - MX - 120, 171, 120, 7, [
        ([t("— Quality over Quantity —", size=10.5, color=GOLD_L,
            serif=True, italic=True)], dict(align=PP_ALIGN.RIGHT)),
    ])

    # ================= P.02 01/EXECUTIVE SUMMARY =================
    s = add_slide(prs)
    sec_label(s, "01 / EXECUTIVE SUMMARY")
    y = big_title(s, [[t("絞るから、"), t("届く", color=GOLD), t("。")]])
    lead(s, "トップクラスのCAだけが参加できる、スカウトと指名の双方向マッチングです。", y + 1)
    cards = [
        ("01", "届くスカウト", "SCOUTS THAT LAND",
         "送り手をトップクラスのCAに限定。総量が絞られ、1通が読まれる。", "light", INK),
        ("02", "指名も届く", "NAMED BY CANDIDATES",
         "求職者がプロフィールを見て指名。受け身でも温度の高い面談が届く。", "dark", None),
        ("03", "成約まで費用ゼロ", "SUCCESS FEE ONLY",
         "初年度利用料0円。費用は成約時に、紹介手数料の20%だけ。", "light", GOLD),
    ]
    cw, ch, gap = 94, 74, 7.8
    cy = 76
    for i, (num, head, eng, body, mode, rule) in enumerate(cards):
        cx = MX + i * (cw + gap)
        dark_card = (mode == "dark")
        rect(s, cx, cy, cw, ch, fill=(DARK if dark_card else CREAM2))
        if rule is not None:
            hline(s, cx, cy - 0.6, cw, color=rule, th=0.6)
        text_box(s, cx + 9, cy + 12, cw - 18, ch - 20, [
            ([t(num, size=16, color=(GOLD_L if dark_card else GOLD_T),
                serif=True, italic=True)], dict(after=8)),
            ([t(head, size=13.5, bold=True,
                color=(WHITE if dark_card else INK))], dict(after=1.5)),
            ([t(eng, size=6.8, color=(GRAY_D2 if dark_card else GRAY), spc=2)],
             dict(after=6)),
            ([t(body, size=9.5, color=(GRAY_D if dark_card else INK))],
             dict(spacing=1.5)),
        ])

    # ================= P.03 02/PROBLEM =================
    s = add_slide(prs)
    sec_label(s, "02 / PROBLEM")
    y = big_title(s, [[t("スカウトは、もう"), t("読まれていない", color=RED), t("。")]])
    lead(s, "同じデータベースに送り手が殺到し、優秀層の受信箱は飽和しています。", y + 1)
    py, ph = 74, 96
    lw = 141
    rect(s, MX, py, lw, ph, fill=CREAM2)
    hline(s, MX, py - 0.6, lw, color=INK, th=0.6)
    text_box(s, MX + 10, py + 10, lw - 20, ph - 18, [
        ([t("SENDERS　—　送り手", size=8.5, color=GOLD_T, serif=True,
            italic=True, spc=2)], dict(after=8)),
        ([t("41,800", size=38, color=INK, serif=True),
          t(" 社", size=13, color=INK, bold=True)], dict(after=1)),
        ([t("ビズリーチ 累計導入企業数（2026年1月末・公表値）", size=7.3, color=GRAY)],
         dict(after=8)),
        ([t("9,700", size=23, color=INK, serif=True),
          t(" 名+", size=11, color=INK, bold=True)], dict(after=1, before=6)),
        ([t("同・登録ヘッドハンター数", size=7.3, color=GRAY)], {}),
    ])
    hline(s, MX + 10, py + 52, lw - 20, color=GOLD, th=0.4)
    text_box(s, MX + lw + 2, py, 16, ph, [
        ([t("→", size=15, color=GRAY)], dict(align=PP_ALIGN.CENTER)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    rx = MX + lw + 20
    rw = W - MX - rx
    rect(s, rx, py, rw, ph, fill=DARK)
    text_box(s, rx + 10, py + 10, rw - 20, ph - 18, [
        ([t("RECEIVERS　—　受け手（優秀層）", size=8.5, color=GOLD_L, serif=True,
            italic=True, spc=2)], dict(after=8)),
        ([t("2−10", size=38, color=WHITE, serif=True),
          t(" %", size=14, color=WHITE, bold=True)], dict(after=1)),
        ([t("スカウト返信率の業界レンジ（平均は約5%）", size=7.3, color=GRAY_D2)],
         dict(after=16)),
        ([t("面談5件の確保に、", size=11, color=WHITE, bold=True)],
         dict(spacing=1.5)),
        ([t("約100通の送信が必要な計算。", size=11, color=WHITE, bold=True)],
         dict(spacing=1.5)),
    ])
    hline(s, rx + 10, py + 47, rw - 20, color=GOLD, th=0.4)
    src_note(s, "出典: ビズリーチ公式サイト公表値（2026年1月末時点） / VOLLECT・buddy-data・miidas スカウト返信率調査（2025〜2026年）")

    # ================= P.04 03/CANDIDATES =================
    s = add_slide(prs)
    sec_label(s, "03 / CANDIDATES")
    big_title(s, [[t("求職者は、"), t("“担当者”", color=GOLD), t("で選びたい。")]])
    sy = 60
    text_box(s, MX, sy, 140, 26, [
        ([t("36", size=44, color=INK, serif=True),
          t(" %", size=16, color=INK, bold=True)], {}),
    ])
    hline(s, MX, sy + 27, 138, color=GOLD, th=0.4)
    text_box(s, MX, sy + 30, 140, 6, [
        ([t("転職エージェントを「信用できない」と回答（利用経験者調査）",
            size=7.5, color=GRAY)], {}),
    ])
    x2 = MX + 160
    text_box(s, x2, sy, 140, 26, [
        ([t("4.2", size=44, color=INK, serif=True),
          t(" 社", size=16, color=INK, bold=True)], {}),
    ])
    hline(s, x2, sy + 27, 137, color=GOLD, th=0.4)
    text_box(s, x2, sy + 30, 140, 6, [
        ([t("転職決定者が登録するエージェント数（利用者全体の平均は約2.1社）",
            size=7.5, color=GRAY)], {}),
    ])
    by = sy + 46
    hline(s, MX, by, 138, color=GRAY, th=0.25)
    text_box(s, MX, by + 4, 140, 40, [
        ([t("不満・不信の上位", size=11.5, color=INK, bold=True)], dict(after=4)),
        ([t("・ 担当者の企業・業界知識の不足", size=8.8, color=INK)],
         dict(spacing=1.6)),
        ([t("・ 転職を急かす強引な提案", size=8.8, color=INK)], dict(spacing=1.6)),
        ([t("・ 希望と合わない求人ばかりの紹介", size=8.8, color=INK)],
         dict(spacing=1.6)),
    ])
    rect(s, x2 - 7, by + 2, W - MX - x2 + 7, 40, fill=DARK)
    text_box(s, x2 + 3, by + 8, W - MX - x2 - 13, 30, [
        ([t("— INSIGHT —", size=7.5, color=GOLD_L, spc=2)], dict(after=4)),
        ([t("複数登録は「担当者ガチャ」へのヘッジ行動。実績あるCAを自分で選べる場には、求職者側の明確な需要がある。",
            size=10, color=WHITE, bold=True)], dict(spacing=1.55)),
    ])
    src_note(s, "出典: マイナビスカウティング調査（2024年, n=101） / hape 転職エージェント利用者調査（2025年, n=320） / リクナビNEXT調べ")

    # ================= P.05 04/SOLUTION（ダーク） =================
    s = add_slide(prs, dark=True)
    hline(s, MX, 13, CW, color=GOLD, th=0.35)
    text_box(s, MX, 24, 200, 7, [
        ([t("04 / SOLUTION", size=10.5, color=GOLD_L, serif=True, italic=True,
            spc=2.5)], {}),
    ])
    hline(s, MX, 32.3, 11.5, color=GOLD, th=0.6)
    text_box(s, MX, 39, CW, 34, [
        ([t("送り手を絞ることで、", size=27, color=WHITE, serif=True, bold=True,
            spc=1)], dict(spacing=1.3)),
        ([t("“", size=27, color=WHITE, serif=True, bold=True),
          t("届く", size=27, color=GOLD_L, serif=True, bold=True),
          t("”を取り戻す。", size=27, color=WHITE, serif=True, bold=True)],
         dict(spacing=1.3)),
    ])
    text_box(s, MX, 78, CW, 9, [
        ([t("MarkGate", size=14, color=WHITE, serif=True),
          t(".", size=14, color=GOLD, serif=True),
          t("　— 審査制 × 届くスカウト × 指名", size=10, color=GRAY_D, spc=2)], {}),
    ])
    cols = [
        ("Quality", "実績・専門性・支援品質で審査。トップクラスのCAだけが参加できる。"),
        ("Reach", "送信総量が絞られるから、1通が埋もれない。返信率を構造で高める設計。"),
        ("Choice", "求職者からの指名も届く。攻めと受け、双方向のマッチング。"),
    ]
    cw3, gap3 = 94, 7.8
    for i, (head, body) in enumerate(cols):
        cx = MX + i * (cw3 + gap3)
        hline(s, cx, 104, cw3, color=GOLD, th=0.4)
        text_box(s, cx, 110, cw3, 12, [
            ([t(head, size=19, color=GOLD_L, serif=True, italic=True)], {}),
        ])
        text_box(s, cx, 124, cw3, 22, [
            ([t(body, size=9.3, color=GRAY_D)], dict(spacing=1.5)),
        ])
    hline(s, MX, 168, CW, color=GOLD, th=0.35)

    # ================= P.06 05/NOMINATION =================
    s = add_slide(prs)
    sec_label(s, "05 / NOMINATION")
    y = big_title(s, [[t("求職者が、CAを"), t("“指名”", color=GOLD), t("する。")]])
    lead(s, "“会社宛の問い合わせ”ではなく、“あなた宛の相談”が届きます。", y + 1)
    py, ph = 73, 80
    lw = 141
    rect(s, MX, py, lw, ph, fill=CREAM2)
    hline(s, MX, py - 0.6, lw, color=INK, th=0.6)
    steps = [
        ("01", "審査を通過したCAだけの一覧を見る"),
        ("02", "実績・専門領域・支援スタイルで比較する"),
        ("03", "「この人に相談したい」— 指名する"),
    ]
    paras = [([t("CANDIDATE　—　求職者の体験", size=8.5, color=GOLD_T,
                 serif=True, italic=True, spc=2)], dict(after=9))]
    for num, txt in steps:
        paras.append(([t(num + "　", size=11, color=GOLD_T, serif=True, italic=True),
                       t(txt, size=10, color=INK)], dict(spacing=1.5, after=7)))
    text_box(s, MX + 10, py + 9, lw - 20, ph - 16, paras)
    text_box(s, MX + lw + 2, py, 16, ph, [
        ([t("→", size=15, color=GRAY)], dict(align=PP_ALIGN.CENTER)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    rx = MX + lw + 20
    rw = W - MX - rx
    rect(s, rx, py, rw, ph, fill=DARK)
    text_box(s, rx + 10, py + 9, rw - 20, ph - 16, [
        ([t("YOUR CA　—　貴社CAの受信箱", size=8.5, color=GOLD_L, serif=True,
            italic=True, spc=2)], dict(after=7)),
        ([t("「あなたに相談したい」という", size=12.5, color=WHITE, bold=True)],
         dict(spacing=1.5)),
        ([t("指名リクエストが、直接届く。", size=12.5, color=WHITE, bold=True)],
         dict(spacing=1.5, after=8)),
        ([t("自らCAを選んだ求職者だから、面談への温度が最初から高い。辞退や音信不通が起きにくい構造です。",
            size=8.8, color=GRAY_D)], dict(spacing=1.5, before=10)),
    ])
    hline(s, rx + 10, py + 38.5, rw - 20, color=GOLD, th=0.4)
    band(s, [
        t("プロフィールは貴社の資産 — ", size=10.5, color=WHITE),
        t("エースの実績が、24時間はたらく集客装置になる。", size=10.5,
          color=GOLD_L, bold=True),
    ], y=161)

    # ================= P.07 06/HOW IT WORKS =================
    s = add_slide(prs)
    sec_label(s, "06 / HOW IT WORKS")
    big_title(s, [[t("仕組み — 貴社の業務は、"), t("これまで通り", color=GOLD),
                   t("。")]])
    steps = [
        ("01", "審査・登録", "貴社アドバイザーが実績・専門性の審査にエントリー。"),
        ("02", "プロフィール公開", "得意領域・実績・人柄をプラットフォームに掲載。"),
        ("03", "スカウト & 指名", "CAからのスカウトも、求職者からの指名も。双方向でつながる。"),
        ("04", "面談・成約", "以降は通常の紹介業務。成約時に初めて費用が発生します。"),
    ]
    cw4, gap4 = 70.4, 5.3
    for i, (num, head, body) in enumerate(steps):
        cx = MX + i * (cw4 + gap4)
        col_item(s, cx, 64, cw4, num, head, body, head_size=12.5)
    band(s, [
        t("送り手が絞られているから、1通のスカウトが競争に埋もれない。",
          size=10.5, color=WHITE),
        t("母集団形成はプラットフォームの仕事です。", size=10.5, color=GOLD_L,
          bold=True),
    ])

    # ================= P.08 07/SCREENING =================
    s = add_slide(prs)
    sec_label(s, "07 / SCREENING")
    y = big_title(s, [[t("審査は、狭き門ほど、"), t("価値", color=GOLD),
                       t("になる。")]])
    lead(s, "「誰でも登録できる場」にしないこと自体が、貴社のスカウトが届く理由です。", y + 1)
    crits = [
        ("実績", "TRACK RECORD", "支援領域での決定実績・経験を、事実ベースで確認します。"),
        ("専門性", "EXPERTISE", "業界・職種への理解の深さと、得意領域の明確さを審査します。"),
        ("支援品質", "QUALITY", "求職者本位の支援姿勢。参画後も求職者評価で継続的に確認します。"),
    ]
    cy = 72
    for head, eng, body in crits:
        hline(s, MX, cy, 152, color=GOLD, th=0.4)
        text_box(s, MX, cy + 3.5, 152, 7, [
            ([t(head, size=12, color=INK, bold=True),
              t("　" + eng, size=7, color=GRAY, spc=2)], {}),
        ])
        text_box(s, MX, cy + 11, 152, 8, [
            ([t(body, size=8.8, color=INK)], dict(spacing=1.4)),
        ])
        cy += 28.5
    rx = MX + 168
    rw = W - MX - rx
    rect(s, rx, 68, rw, 87, fill=DARK)
    entry = [
        "審査の結果は、外部に一切公開されません",
        "不通過の場合も、実績を積んでの再エントリーが可能です",
        "審査通過後、掲載するかどうかは貴社が決められます",
    ]
    paras = [
        ([t("Entry", size=15, color=GOLD_L, serif=True, italic=True)],
         dict(after=3)),
        ([t("安心してエントリーいただくために", size=10.5, color=WHITE, bold=True)],
         dict(after=7)),
    ]
    for e in entry:
        paras.append(([t("◎　", size=9, color=GOLD_L),
                       t(e, size=9, color=WHITE)], dict(spacing=1.5, after=6)))
    paras.append(([t("※審査基準の詳細は、説明会でご確認いただけます。",
                     size=6.8, color=GRAY_D2)], dict(before=3)))
    text_box(s, rx + 9, 76, rw - 18, 75, paras)
    band(s, [
        t("審査があるから — ", size=10.5, color=WHITE),
        t("「掲載されている」こと自体が、貴社アドバイザーの証明になる。",
          size=10.5, color=GOLD_L, bold=True),
    ])

    # ================= P.09 08/PRODUCTIVITY =================
    s = add_slide(prs)
    sec_label(s, "08 / PRODUCTIVITY")
    y = big_title(s, [[t("“送る仕事”を、減らす"), t("構造", color=GOLD),
                       t("。")]])
    lead(s, "数値ではなく、工数が減る「仕組み」でご説明します。理由は3つあります。", y + 1)
    cols = [
        ("01", "大量送信が、前提でなくなる",
         "送り手が絞られた場では、埋もれ対策の“数打ち”が要らない。読まれる前提で、1通に時間を使えます。"),
        ("02", "指名は、送信ゼロで届く",
         "プロフィールを見た求職者から、面談リクエストが届く。待っている間の母集団形成は、当社の仕事です。"),
        ("03", "追いかける時間が、減る",
         "自らCAを選んだ求職者は、面談への温度が高い。音信不通や日程再調整に費やす工数が構造的に小さい。"),
    ]
    cw3, gap3 = 94, 7.8
    for i, (num, head, body) in enumerate(cols):
        col_item(s, MX + i * (cw3 + gap3), 72, cw3, num, head, body,
                 head_size=12)
    band(s, [
        t("送信に使っていた時間を、面談と支援へ。", size=10.5, color=WHITE),
        t("削減幅は、説明会で貴社の運用に合わせて一緒に試算します。", size=10.5,
          color=GOLD_L, bold=True),
    ])

    # ================= P.10 09/AUDIENCE =================
    s = add_slide(prs)
    sec_label(s, "09 / AUDIENCE")
    y = big_title(s, [[t("母集団は、「CAを"), t("選びたい人", color=GOLD),
                       t("」から。")]])
    lead(s, "貴社に集客をお願いすることはありません。母集団形成は、当社の責任です。", y + 1)
    items = [
        ("不満の、受け皿になる",
         "スカウト過多と「担当者ガチャ」への不満はすでに定量化されています（→ 03）。「担当者を自分で選べる」体験そのものが、移る動機になります。"),
        ("プロフィールが、入り口になる",
         "審査通過CAの公開プロフィールが、検索と比較の受け皿に。掲載が増えるほど、母集団の入り口も増える構造です。"),
        ("広く浅くは、やらない",
         "初期はハイクラス×主要領域に絞り、LP・SNS・PRを集中投下。審査制という切り口自体が、発信の素材になります。"),
    ]
    cy = 70
    for head, body in items:
        hline(s, MX, cy, 152, color=GOLD, th=0.4)
        text_box(s, MX, cy + 3.5, 152, 7, [
            ([t(head, size=12, color=INK, bold=True)], {}),
        ])
        text_box(s, MX, cy + 11, 152, 12, [
            ([t(body, size=8.5, color=INK)], dict(spacing=1.45)),
        ])
        cy += 29.5
    rx = MX + 168
    rw = W - MX - rx
    rect(s, rx, 66, rw, 89, fill=DARK)
    text_box(s, rx + 9, 74, rw - 18, 46, [
        ([t("Balance", size=15, color=GOLD_L, serif=True, italic=True)],
         dict(after=3)),
        ([t("需給バランスの管理", size=10.5, color=WHITE, bold=True)],
         dict(after=5)),
        ([t("初期は参加CA数を意図的に絞り、求職者数とのバランスを見ながら段階的に拡大します。「登録したのに、指名が来ない」を避けるための設計です。",
            size=8.8, color=GRAY_D)], dict(spacing=1.5)),
    ])
    hline(s, rx + 9, 124, rw - 18, color=GOLD, th=0.4)
    text_box(s, rx + 9, 129, rw - 18, 20, [
        ([t("だから完全成果報酬 — 集客投資のリスクは、貴社ではなく当社が負います。",
            size=8.8, color=WHITE)], dict(spacing=1.5)),
    ])
    band(s, [
        t("求職者が集まらなければ、当社の売上もゼロ — ", size=10.5, color=WHITE),
        t("母集団形成に本気である理由は、料金体系そのものです。", size=10.5,
          color=GOLD_L, bold=True),
    ])

    # ================= P.11 10/DIFFERENTIATION =================
    s = add_slide(prs)
    sec_label(s, "10 / DIFFERENTIATION")
    y = big_title(s, [[t("既存チャネルとの、"), t("違い", color=GOLD), t("。")]])
    lead(s, "置き換えではなく、リスクゼロで併用できる「第3のチャネル」です。", y + 1)
    colw = [52, 88, 80, 77.6]
    ty, hh, rh = 71, 15, 14
    rows = [
        ("スカウトの競争環境", ("✕", "誰でも登録可。送信過多で受信箱が飽和"),
         ("—", "スカウト機能なし"), ("◎", "審査制で送り手を限定")),
        ("求職者からの指名", ("✕", "不可"), ("✕", "不可"), ("◎", "指名が届く")),
        ("成約前の費用", ("✕", "基本料金60万円/6か月〜 +通数課金"),
         ("✕", "面談1件 1.4万〜3.5万円"), ("◎", "0円（初年度は利用料も無料）")),
        ("成功報酬", ("✕", "手数料の30%（初回契約の例）"),
         ("△", "面談購入費が別途先行"), ("◎", "手数料の20%")),
    ]
    total_h = hh + rh * len(rows)
    # ヘッダー
    rect(s, MX, ty, colw[0] + colw[1] + colw[2], hh, fill=CREAM3)
    x3 = MX + colw[0] + colw[1] + colw[2]
    rect(s, x3, ty, colw[3], total_h, fill=DARK)  # MarkGate列（全行ダーク）
    heads = [
        ("比較軸", None, INK), ("スカウト型DB", "ビズリーチ等", INK),
        ("送客型サービス", "面談課金・リスト課金", INK),
        ("MarkGate", "審査制×双方向マッチング", WHITE),
    ]
    tx = MX
    for i, (head, sub, color) in enumerate(heads):
        paras = [([t(head, size=10, color=color, bold=True)], {})]
        if sub:
            paras.append(([t(sub, size=6.8,
                             color=(GOLD_L if i == 3 else GRAY), spc=1)], {}))
        text_box(s, tx + 5, ty + 2.2, colw[i] - 10, hh - 4, paras)
        tx += colw[i]
    # 本文行
    mark_color = {"✕": RED, "△": GRAY, "—": GRAY, "◎": GOLD}
    ry = ty + hh
    for label_, c1, c2, c3 in rows:
        hline(s, MX, ry, colw[0] + colw[1] + colw[2], color=GRAY, th=0.2)
        hline(s, x3 + 4, ry, colw[3] - 8, color=RGBColor.from_string("3A3323"),
              th=0.2)
        text_box(s, MX + 5, ry, colw[0] - 8, rh, [
            ([t(label_, size=9, color=INK, bold=True)], {}),
        ], anchor=MSO_ANCHOR.MIDDLE)
        for ci, cell in ((1, c1), (2, c2)):
            cx = MX + sum(colw[:ci])
            text_box(s, cx + 5, ry, colw[ci] - 10, rh, [
                ([t(cell[0] + " ", size=9, color=mark_color[cell[0]], bold=True),
                  t(cell[1], size=8.8, color=INK)], dict(spacing=1.25)),
            ], anchor=MSO_ANCHOR.MIDDLE)
        text_box(s, x3 + 5, ry, colw[3] - 10, rh, [
            ([t(c3[0] + " ", size=9, color=GOLD_L, bold=True),
              t(c3[1], size=8.8, color=WHITE)], dict(spacing=1.25)),
        ], anchor=MSO_ANCHOR.MIDDLE)
        ry += rh
    src_note(s, "※各サービスの内容・料金は公開情報に基づく一般的な整理であり、個別の契約条件により異なります。")

    # ================= P.12 11/ECONOMICS =================
    s = add_slide(prs)
    sec_label(s, "11 / ECONOMICS")
    y = big_title(s, [[t("同じ1成約で、"), t("手残り", color=GOLD),
                       t("が変わる。")]])
    lead(s, "理論年収600万円・紹介手数料率35%の場合の試算です。", y + 1)
    fy = 70
    text_box(s, MX, fy, 62, 22, [
        ([t("理論年収（例）", size=7.5, color=GRAY)], dict(after=2)),
        ([t("600", size=30, color=INK, serif=True),
          t(" 万円", size=12, color=INK, bold=True)], {}),
    ])
    text_box(s, MX + 64, fy + 9, 12, 10, [
        ([t("×", size=13, color=GRAY)], dict(align=PP_ALIGN.CENTER)),
    ])
    text_box(s, MX + 78, fy, 50, 22, [
        ([t("紹介手数料率（例）", size=7.5, color=GRAY)], dict(after=2)),
        ([t("35", size=30, color=INK, serif=True),
          t(" %", size=12, color=INK, bold=True)], {}),
    ])
    text_box(s, MX + 128, fy + 9, 12, 10, [
        ([t("=", size=13, color=GRAY)], dict(align=PP_ALIGN.CENTER)),
    ])
    rect(s, MX + 145, fy - 2, 90, 27, fill=DARK)
    text_box(s, MX + 153, fy + 1.5, 76, 22, [
        ([t("成約時に発生する紹介手数料", size=7.5, color=GOLD_L)], dict(after=2)),
        ([t("210", size=27, color=WHITE, serif=True),
          t(" 万円", size=12, color=WHITE, bold=True)], {}),
    ])
    dy = 107
    text_box(s, MX, dy - 6, 100, 5, [
        ([t("手数料の分配", size=7.5, color=GRAY, spc=1)], {}),
    ])
    bw_total = CW
    bw80 = bw_total * 0.8
    rect(s, MX, dy, bw80, 14, fill=DARK)
    rect(s, MX + bw80, dy, bw_total - bw80, 14, fill=GOLD)
    text_box(s, MX, dy, bw80, 14, [
        ([t("貴社の受取 168万円 (80%)", size=11, color=WHITE, bold=True)],
         dict(align=PP_ALIGN.CENTER)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    text_box(s, MX + bw80, dy, bw_total - bw80, 14, [
        ([t("42万円", size=10, color=DARK, bold=True)],
         dict(align=PP_ALIGN.CENTER)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    text_box(s, MX, dy + 15.5, bw_total, 5, [
        ([t("プラットフォーム利用分（20%）", size=7.3, color=GRAY)],
         dict(align=PP_ALIGN.RIGHT)),
    ])
    ny = dy + 27
    text_box(s, MX, ny, 150, 18, [
        ([t("スカウト型DB経由の一例: ", size=9, color=INK, bold=True),
          t("成功報酬30%なら63万円+固定費・通数課金。手残りが20万円以上変わる。",
            size=9, color=INK)], dict(spacing=1.5)),
    ])
    rect(s, MX + 168, ny - 3, CW - 168, 20, fill=DARK)
    text_box(s, MX + 176, ny - 3, CW - 184, 20, [
        ([t("MarkGate: ", size=9.5, color=GOLD_L, bold=True),
          t("成約まで0円。スカウト工数の削減まで含めて、利益率が変わる。",
            size=9.5, color=WHITE, bold=True)], dict(spacing=1.5)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    src_note(s, "※試算は例示です。30%はスカウト型媒体の紹介会社向け初回契約の公開情報の一例。実際の条件は各社の契約によります。")

    # ================= P.13 12/FOR YOUR BRAND =================
    s = add_slide(prs)
    sec_label(s, "12 / FOR YOUR BRAND")
    big_title(s, [[t("「審査制」は、貴社の"), t("ブランド", color=GOLD),
                   t("になる。")]])
    items = [
        ("合格実績が、会社の信用に",
         "「審査通過アドバイザー○名在籍」は、求職者にも求人企業にも通じる証明になる。"),
        ("契約は、法人単位",
         "ご契約・請求・成約売上はすべてエージェント法人に紐づく設計。個人への報酬の直接支払いはありません。"),
        ("育成の、ものさしに",
         "審査基準と求職者からの評価が、アドバイザー教育のKPIとして機能する。"),
    ]
    cy = 62
    for head, body in items:
        hline(s, MX, cy, 152, color=GOLD, th=0.4)
        text_box(s, MX, cy + 3.5, 152, 7, [
            ([t(head, size=12, color=INK, bold=True)], {}),
        ])
        text_box(s, MX, cy + 11, 152, 12, [
            ([t(body, size=8.8, color=INK)], dict(spacing=1.45)),
        ])
        cy += 31
    rx = MX + 168
    rw = W - MX - rx
    rect(s, rx, 58, rw, 98, fill=DARK)
    text_box(s, rx + 9, 66, rw - 18, 84, [
        ([t("Q.", size=15, color=GOLD_L, serif=True, italic=True)],
         dict(after=3)),
        ([t("エース社員が個人として有名になると、独立や引き抜きが心配…",
            size=10.5, color=WHITE, bold=True)], dict(spacing=1.5, after=7)),
        ([t("A.", size=15, color=GOLD_L, serif=True, italic=True)],
         dict(after=3)),
        ([t("指名は「貴社所属の○○さん」に届きます。プロフィール・実績・評価は会社の資産として蓄積され、採用広報にも活用できます。",
            size=9.3, color=GRAY_D)], dict(spacing=1.55, after=5)),
        ([t("※公開範囲は貴社ポリシーに合わせ設定可能。", size=6.8, color=GRAY_D2)],
         {}),
    ])

    # ================= P.14 13/FAQ =================
    s = add_slide(prs)
    sec_label(s, "13 / FAQ")
    big_title(s, [[t("よくいただく、"), t("4つ", color=GOLD),
                   t("のご質問。")]])
    faqs = [
        ("求職者は、集まるのか?",
         [t("ローンチ前のため、実績数値はまだありません。だからこそ、料金は", size=8.8, color=INK),
          t("完全成果報酬", size=8.8, color=INK, bold=True),
          t(" — 成約が生まれるまで費用は一切発生せず、集客投資のリスクは当社が負う設計です。（集め方は 09 / AUDIENCE）",
            size=8.8, color=INK)]),
        ("成功報酬20%は、高くないか?",
         [t("スカウト型媒体は成功報酬30%の例に加え、", size=8.8, color=INK),
          t("成約ゼロでも固定費・通数課金が発生", size=8.8, color=INK, bold=True),
          t("します。かかる総費用と「手残り」での比較をおすすめします。（→ 11 / ECONOMICS）",
            size=8.8, color=INK)]),
        ("既存チャネルと併用できるか?",
         [t("併用が前提の設計です。", size=8.8, color=INK, bold=True),
          t("専任契約や独占をお願いすることはありません。今お使いの媒体を止めずに、費用ゼロの「第3のチャネル」として追加できます。",
            size=8.8, color=INK)]),
        ("始めるのに、手間はかからないか?",
         [t("エントリーは法人単位の簡単な書類から。", size=8.8, color=INK),
          t("プロフィール制作は当社が伴走", size=8.8, color=INK, bold=True),
          t("するため、貴社アドバイザーの追加負担は最小限です。運用開始後の業務は、これまでの紹介業務と変わりません。",
            size=8.8, color=INK)]),
    ]
    fw, fh_gap = 143, 44
    for i, (q, a_runs) in enumerate(faqs):
        fx = MX + (i % 2) * (fw + 11.6)
        fy = 62 + (i // 2) * fh_gap
        hline(s, fx, fy, fw, color=INK, th=0.3)
        text_box(s, fx, fy + 3.5, fw, 7, [
            ([t("Q. ", size=11, color=GOLD_T, serif=True, italic=True, bold=True),
              t(q, size=11.5, color=INK, bold=True)], {}),
        ])
        text_box(s, fx, fy + 11.5, fw, 26, [
            (a_runs, dict(spacing=1.5)),
        ])
    band(s, [
        t("4つに共通する設計 — ", size=10.5, color=WHITE),
        t("貴社がリスクを取らずに、試せること。", size=10.5, color=GOLD_L,
          bold=True),
        t(" 成約まで、1円もかかりません。", size=10.5, color=WHITE),
    ])

    # ================= P.15 14/PRICING =================
    s = add_slide(prs)
    sec_label(s, "14 / PRICING")
    big_title(s, [[t("成約まで、"), t("費用はかかりません", color=GOLD),
                   t("。")]])
    py, ph = 62, 100
    lw = 145
    rect(s, MX, py, lw, ph, fill=DARK)
    text_box(s, MX + 12, py + 12, lw - 24, ph - 22, [
        ([t("SUCCESS FEE　·　成約時のみ", size=8.5, color=GOLD_L, spc=2.5)],
         dict(after=8)),
        ([t("20", size=46, color=WHITE, serif=True),
          t(" %", size=18, color=GOLD_L, bold=True)], dict(after=2)),
        ([t("成約時の紹介手数料に対して", size=8.5, color=GRAY_D)], dict(after=18)),
        ([t("貴社の取り分 ", size=12, color=WHITE, bold=True),
          t("80%", size=12, color=GOLD_L, bold=True)], dict(before=6)),
    ])
    hline(s, MX + 12, py + 58, lw - 24, color=RGBColor.from_string("3A3323"),
          th=0.3)
    rx = MX + lw + 12
    rw = W - MX - rx
    bh = 47
    rect(s, rx, py, rw, bh, fill=CREAM2)
    hline(s, rx, py - 0.6, rw, color=INK, th=0.6)
    text_box(s, rx + 10, py + 7, rw - 20, bh - 12, [
        ([t("YEAR 1", size=8, color=GRAY, spc=2.5)], dict(after=3)),
        ([t("¥0", size=24, color=INK, serif=True),
          t("　初年度 利用料", size=10.5, color=INK, bold=True)], dict(after=3)),
        ([t("登録・掲載・スカウト・指名の受信・面談まで、すべて無料。",
            size=8.5, color=GRAY)], {}),
    ])
    y2 = py + bh + 6
    rect(s, rx, y2, rw, bh, fill=CREAM2)
    hline(s, rx, y2 - 0.6, rw, color=GOLD, th=0.6)
    text_box(s, rx + 10, y2 + 7, rw - 20, bh - 12, [
        ([t("YEAR 2+", size=8, color=GOLD_T, spc=2.5)], dict(after=3)),
        ([t("¥50,000", size=22, color=INK, serif=True),
          t("　月額（2年目以降）", size=10.5, color=INK, bold=True)], dict(after=3)),
        ([t("平均決定単価 約103万円/件の一部で回収できる水準です。",
            size=8.5, color=GRAY)], {}),
    ])
    src_note(s, "スカウト通数課金・広告費・送客費・掲載料は一切なし。　※平均決定単価の出典: 厚生労働省「令和6年度職業紹介事業報告書の集計結果」")

    # ================= P.16 15/LAUNCH PARTNER =================
    s = add_slide(prs)
    sec_label(s, "15 / LAUNCH PARTNER")
    big_title(s, [[t("ローンチパートナーを、"), t("募集します", color=GOLD),
                   t("。")]])
    tl = [
        ("先行登録の受付（現在）", "法人単位でエントリー。アドバイザー1名からでも可能。"),
        ("審査・掲載準備", "アドバイザー審査と「選ばれるプロフィール」制作を支援。"),
        ("サービスローンチ", "先行登録エージェント様から優先的に掲載を開始します（時期は確定後にご案内）。"),
    ]
    cy = 66
    for i, (head, body) in enumerate(tl):
        dot = s.shapes.add_shape(MSO_SHAPE.OVAL, Mm(MX + 1.2), Mm(cy + 1.5),
                                 Mm(3.4), Mm(3.4))
        dot.fill.solid()
        dot.fill.fore_color.rgb = GOLD
        dot.line.fill.background()
        dot.shadow.inherit = False
        if i < len(tl) - 1:
            rect(s, MX + 2.7, cy + 6.5, 0.35, 25, fill=GOLD_L)
        text_box(s, MX + 11, cy, 140, 7, [
            ([t(head, size=12.5, color=INK, bold=True)], {}),
        ])
        text_box(s, MX + 11, cy + 7.5, 140, 10, [
            ([t(body, size=8.8, color=GRAY)], dict(spacing=1.4)),
        ])
        cy += 30
    rx = MX + 168
    rw = W - MX - rx
    rect(s, rx, 60, rw, 96, fill=DARK)
    merits = [
        ("01", "初期ほど、スカウトが効く",
         "参加CAを限定してローンチ。送信競争が最も少ない時期に始められる。"),
        ("02", "露出の優先",
         "検索結果・特集企画で、先行登録アドバイザーを優先表示。"),
        ("03", "サービス設計に参画",
         "審査基準・機能へのご要望をローンチ前に直接反映。"),
    ]
    paras = [([t("先行登録 — 3つのメリット", size=11.5, color=WHITE, bold=True)],
              dict(after=8))]
    for num, head, body in merits:
        paras.append(([t(num + "　", size=10.5, color=GOLD_L, serif=True,
                         italic=True),
                       t(head, size=10.5, color=WHITE, bold=True)],
                      dict(after=1.5)))
        paras.append(([t(body, size=8.3, color=GRAY_D)],
                      dict(spacing=1.45, after=6)))
    text_box(s, rx + 10, 69, rw - 20, 82, paras)
    src_note(s, "※求職者との需給バランスを保つため、同一領域の先行登録枠には上限を設けています。")

    # ================= P.17 16/CONTACT（ダーク） =================
    s = add_slide(prs, dark=True)
    hline(s, MX, 13, CW, color=GOLD, th=0.35)
    text_box(s, MX, 26, 200, 7, [
        ([t("16 / CONTACT", size=10.5, color=GOLD_L, serif=True, italic=True,
            spc=2.5)], {}),
    ])
    hline(s, MX, 34.3, 11.5, color=GOLD, th=0.6)
    text_box(s, MX, 42, CW, 36, [
        ([t("絞られた場所でだけ、", size=27, color=WHITE, serif=True, bold=True,
            spc=1)], dict(spacing=1.3)),
        ([t("スカウトも指名も", size=27, color=GOLD_L, serif=True, bold=True,
            spc=1),
          t("、届く。", size=27, color=WHITE, serif=True, bold=True, spc=1)],
         dict(spacing=1.3)),
    ])
    text_box(s, MX, 84, CW, 8, [
        ([t("まずは30分のオンライン説明会で、貴社に合わせた活用シミュレーションをご提案します。",
            size=10.5, color=GRAY_D, spc=1)], {}),
    ])
    rect(s, MX, 96, 152, 12, line=GOLD, line_w=0.75)
    text_box(s, MX, 96, 152, 12, [
        ([t("先行登録・説明会は無料 — 掲載の義務や、専任の縛りはありません。",
            size=9.3, color=GOLD_L)], dict(align=PP_ALIGN.CENTER)),
    ], anchor=MSO_ANCHOR.MIDDLE)
    hline(s, MX, 138, CW, color=GOLD, th=0.35)
    text_box(s, MX, 146, 160, 20, [
        ([t("MarkGate", size=22, color=WHITE, serif=True),
          t(".", size=22, color=GOLD, serif=True)], dict(after=2)),
        ([t("QUALITY OVER QUANTITY　·　2026", size=7, color=GRAY_D2, spc=3)], {}),
    ])
    text_box(s, W - MX - 130, 146, 130, 26, [
        ([t("MarkGate株式会社　代表取締役: 山本 朋鑑", size=8.8, color=GRAY_D)],
         dict(align=PP_ALIGN.RIGHT, spacing=1.6)),
        ([t("設立: 2026年7月13日", size=8.8, color=GRAY_D)],
         dict(align=PP_ALIGN.RIGHT, spacing=1.6)),
        ([t("MAIL・TEL: 確定後に記載", size=8.8, color=GRAY_D)],
         dict(align=PP_ALIGN.RIGHT, spacing=1.6)),
    ])
    text_box(s, MX, 176, 150, 6, [
        ([t("※連絡先は確定後に差し替えてご利用ください。", size=6.8,
            color=GRAY_D2)], {}),
    ])
    text_box(s, W - MX - 100, 176, 100, 6, [
        ([t("— Thank you. —", size=9.5, color=GOLD_L, serif=True, italic=True)],
         dict(align=PP_ALIGN.RIGHT)),
    ])

    prs.save(out_path)
    print(f"saved: {out_path} ({len(prs.slides._sldIdLst)} slides)")


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "MarkGate_sales_deck.pptx"
    build(out)
