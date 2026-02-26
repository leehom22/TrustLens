from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
    ListFlowable,
    ListItem,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
import requests
import tempfile
import os


def generate_analysis_pdf(data: dict, output_path: str):
    """
    Generate AI Document Analysis PDF from JSON data
    """
    # -----------------------------
    # Document Setup
    # -----------------------------
    # temp_files = []
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=40,
        leftMargin=40,
        topMargin=50,
        bottomMargin=40,
    )
    # print("The data received for PDF generation is: ", data)

    styles = getSampleStyleSheet()

    # Custom Styles
    styles.add(
        ParagraphStyle(
            name="RiskHeader",
            fontSize=18,
            textColor=colors.white,
            backColor=colors.darkred,
            alignment=1,
            padding=10,
        )
    )

    styles.add(
        ParagraphStyle(
            name="LayerTitle",
            fontSize=14,
            spaceAfter=6,
            textColor=colors.darkblue,
        )
    )

    styles.add(
        ParagraphStyle(
            name="SmallGrey",
            fontSize=9,
            textColor=colors.grey,
        )
    )
    
    styles.add(
        ParagraphStyle(
            name="ExpertNote",
            parent=styles["BodyText"],
            fontName="Helvetica-Oblique", # Italics
            leftIndent=12,
            borderColor=colors.darkblue,
            borderWidth=1,
            borderPadding=10,
        )
    )

    content = []

    # =============================
    # 1️⃣ REPORT HEADER
    # =============================

    header = data["dashboard_header"]

    content.append(
        Paragraph("TrusLens AI Document Analysis Report", styles["Title"]),
    )
    content.append(Spacer(1, 12))

    meta_table = Table(
        [
            ["Document ID", data["document_id"]],
            ["Processed At", data["processed_at"]],
            ["Document Mame", data["document_name"]],
        ],
        colWidths=[150, 350],
    )

    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.lightgrey),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )

    content.append(meta_table)
    content.append(Spacer(1, 20))

    # =============================
    # 2️⃣ OVERALL RISK DASHBOARD
    # =============================

    risk_color = header.get("risk_level_color", "#FF0000")

    dashboard_table = Table(
        [
            ["Overall Score", f"{header['overall_score']}"],
            ["Risk Level", header["risk_level"]],
            ["Verdict", header["verdict_title"]],
        ],
        colWidths=[200, 300],
    )

    dashboard_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.black),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("PADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )

    content.append(
        Paragraph("Overall Risk Assessment", styles["Heading2"])
    )
    content.append(dashboard_table)
    content.append(Spacer(1, 16))

    # Executive Summary
    content.append(
        Paragraph("AI Executive Summary", styles["Heading3"])
    )
    content.append(
        Paragraph(header["ai_executive_summary"], styles["BodyText"])
    )
    content.append(Spacer(1, 12))

    # Recommendation
    content.append(
        Paragraph("Next Step Recommendation", styles["Heading3"])
    )
    content.append(
        Paragraph(header["next_step_recommendation"], styles["BodyText"])
    )
    content.append(Spacer(1, 20))

    expert_notes = data.get("expert_review_notes")
    
    if expert_notes:
        content.append(
            Paragraph("Expert Review Notes", styles["Heading2"])
        )
        content.append(Spacer(1, 6))
        
        # We wrap it in a Table to give it a nice "boxed" look
        for note in expert_notes:
            
            review_box = Table(
                [[Paragraph(f"<i>{note}</i>", styles["BodyText"])]],
                colWidths=[500]
            )
            review_box.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.aliceblue),
                ('LINELEFT', (0, 0), (0, 0), 3, colors.darkblue), # Blue "quote" bar on the left
                ('PADDING', (0, 0), (-1, -1), 12),
            ]))
            
            content.append(review_box)
            content.append(Spacer(1, 10))
        content.append(Spacer(1, 10))
    else:
        print("No expert review notes found, skipping that section.")
    # =============================
    # 3️⃣ LAYER ANALYSIS
    # =============================

    content.append(
        Paragraph("Layer Analysis Breakdown", styles["Heading2"])
    )
    content.append(Spacer(1, 12))

    for layer in data["layer_results"]:

        # Layer Title
        title = f"{layer['layer_id']} — {layer['layer_title']}"
        content.append(Paragraph(title, styles["LayerTitle"]))

        # Layer Score Table
        layer_table = Table(
            [
                ["Status", layer["status"]],
                ["Score", layer["score"]],
            ],
            colWidths=[150, 350],
        )

        layer_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                    ("PADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )

        content.append(layer_table)
        content.append(Spacer(1, 8))

        # AI Analysis
        content.append(
            Paragraph("<b>AI Analysis</b>", styles["BodyText"])
        )
        content.append(
            Paragraph(layer["ai_analysis"], styles["BodyText"])
        )
        content.append(Spacer(1, 8))

        # Technical Proofs
        if layer.get("technical_proofs"):
            proofs = [
                ListItem(Paragraph(p, styles["BodyText"]))
                for p in layer["technical_proofs"]
            ]

            content.append(
                Paragraph("<b>Technical Proofs</b>", styles["BodyText"])
            )
            content.append(
                ListFlowable(proofs, bulletType="bullet")
            )
            content.append(Spacer(1, 8))

        # Evidence Image
        if layer.get("has_visual_evidence") and layer.get(
            "evidence_image_url"
        ):
            try:
                img_url = layer["evidence_image_url"]
                response = requests.get(img_url)

                tmp = tempfile.NamedTemporaryFile(
                    delete=False, suffix=".png"
                )
                tmp.write(response.content)
                tmp.close()

                content.append(
                    Paragraph(
                        "<b>Visual Evidence</b>",
                        styles["BodyText"],
                    )
                )
                content.append(
                    Image(tmp.name, width=400, height=250)
                )
                content.append(Spacer(1, 12))

            except Exception as e:
                content.append(
                    Paragraph(
                        "⚠ Unable to load evidence image.",
                        styles["SmallGrey"],
                    )
                )

        content.append(Spacer(1, 20))

    # =============================
    # BUILD PDF
    # =============================
    # print(f"Building PDF with content {content}")
    doc.build(content)
    # for f in temp_files:
    #     if os.path.exists(f):
    #         os.remove(f) # Clean up!
    print("PDF successfully built.")
    print(f"✅ PDF generated: {output_path}")
