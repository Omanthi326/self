import os
import re
import hashlib
import datetime
import nltk
from nltk.tokenize import sent_tokenize
from difflib import SequenceMatcher
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import textract

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, 
    Image, Flowable, PageBreak, ListItem, ListFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import red, grey, lightgrey, white, black, blue, darkblue, lightblue
from reportlab.graphics.shapes import Drawing, Line, Rect
from reportlab.graphics.charts.piecharts import Pie
from reportlab.lib.units import inch, cm

# Download necessary NLTK data (run once)
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

def create_segment_paragraphs(text, bgcolor, color=None):
    """
    Creates paragraphs from text segments with appropriate styling for highlighting.
    
    Args:
        text (str): The text to be highlighted
        bgcolor (str): Background color in hex code for highlighting
        color (object): Text color (reportlab.lib.colors object)
        
    Returns:
        list: List of Paragraph objects with appropriate styling
    """
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import Paragraph
    
    styles = getSampleStyleSheet()
    
    # Create a custom style for the highlighted text
    highlight_style = ParagraphStyle(
        name="HighlightStyle",
        parent=styles["Normal"],
        backColor=bgcolor,
        textColor=color if color else styles["Normal"].textColor
    )
    
    # Split text into paragraphs if it contains multiple paragraphs
    paragraphs = text.split('\n')
    
    # Create a list of Paragraph objects
    para_objects = []
    for para in paragraphs:
        if para.strip():  # Only add non-empty paragraphs
            para_objects.append(Paragraph(para, highlight_style))
    
    # If somehow no paragraphs were created, add at least one
    if not para_objects:
        para_objects.append(Paragraph(text, highlight_style))
    
    return para_objects

class HorizontalLineFlowable(Flowable):
    """A flowable that draws a horizontal line."""
    
    def __init__(self, width, thickness=1, color=grey, dash=None):
        Flowable.__init__(self)
        self.width = width
        self.thickness = thickness
        self.color = color
        self.dash = dash
        
    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(self.thickness)
        if self.dash:
            self.canv.setDash(self.dash)
        self.canv.line(0, 0, self.width, 0)
        if self.dash:
            self.canv.setDash()  # Reset dash pattern

class GradientBox(Flowable):
    """A flowable that draws a rectangle with a gradient background."""
    
    def __init__(self, width, height, color1=colors.HexColor("#f0f8ff"), color2=colors.HexColor("#e6f2ff"), 
                border_color=colors.HexColor("#d0e0ff"), border_width=1, radius=5):
        Flowable.__init__(self)
        self.width = width
        self.height = height
        self.color1 = color1
        self.color2 = color2
        self.border_color = border_color
        self.border_width = border_width
        self.radius = radius
        
    def draw(self):
        # Draw background rectangle with rounded corners
        self.canv.setFillColor(self.color1)
        self.canv.setStrokeColor(self.border_color)
        self.canv.setLineWidth(self.border_width)
        self.canv.roundRect(0, 0, self.width, self.height, self.radius, stroke=1, fill=1)
        
        # Add subtle gradient effect (simplified)
        self.canv.setFillColor(self.color2)
        self.canv.roundRect(0, 0, self.width, self.height*0.7, self.radius, stroke=0, fill=1)

def preprocess_text(text):
    """
    Preprocess the text by removing special characters and converting to lowercase.
    """
    # Convert to lowercase and remove special characters
    text = re.sub(r'[^\w\s]', '', text.lower())
    # Remove extra whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def get_interpretation(similarity_score):
    """Return interpretation text based on similarity score."""
    if similarity_score >= 75:
        return "High similarity detected. Manual review strongly recommended."
    elif similarity_score >= 50:
        return "Moderate similarity detected. May require review."
    elif similarity_score >= 25:
        return "Low similarity detected. Likely coincidental."
    else:
        return "Minimal similarity detected. Documents appear distinct."

# Add missing get_file_date function
def get_file_date(file_path):
    """Get file creation/modification date for reporting."""
    try:
        return datetime.datetime.fromtimestamp(os.path.getmtime(file_path)).strftime('%Y-%m-%d')
    except:
        return "Unknown"
    
def extract_text_from_file(file_path):
    """
    Extract text from various file formats using textract.
    Returns the extracted text as a string.
    """
    try:
        # Extract text from various file formats
        text = textract.process(file_path).decode('utf-8')
        # Clean up the text
        text = re.sub(r'\n+', '\n', text)  # Replace multiple newlines with single
        text = re.sub(r'\t', ' ', text)    # Replace tabs with spaces
        return text
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""

def get_report_filename(file1_path, file2_path):
    """
    Generate a unique report filename based on the input file names and a timestamp.
    """
    file1_name = os.path.basename(file1_path)
    file2_name = os.path.basename(file2_path)
    
    # Create a hash of the filenames to ensure uniqueness
    hash_str = hashlib.md5(f"{file1_name}_{file2_name}_{datetime.datetime.now()}".encode()).hexdigest()[:8]
    
    return f"similarity_report_{hash_str}.pdf"

def create_pie_chart(data_dict, width=400, height=200):
    """
    Create a pie chart Drawing object.
    """
    drawing = Drawing(width, height)
    
    # Define the pie chart
    pie = Pie()
    pie.x = width // 2
    pie.y = height // 2
    pie.width = width * 0.7
    pie.height = height * 0.7
    
    # Data and labels
    pie.data = list(data_dict.values())
    pie.labels = list(data_dict.keys())
    
    # Set colors for similar and different content
    if "Similar Content" in data_dict:
        pie_colors = [red, lightgrey]
        if data_dict["Similar Content"] > 50:
            pie_colors = [darkblue, lightblue]
    else:
        pie_colors = [darkblue, lightblue]
    
    pie.slices.strokeWidth = 0.5
    pie.slices[0].fillColor = pie_colors[0]
    pie.slices[1].fillColor = pie_colors[1]
    
    drawing.add(pie)
    return drawing

def calculate_similarity_score(text1, text2):
    preprocessed_text1 = preprocess_text(text1)
    preprocessed_text2 = preprocess_text(text2)

    vectorizer = TfidfVectorizer()
    tfidf_matrix = vectorizer.fit_transform([preprocessed_text1, preprocessed_text2])
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

    return round(similarity * 100, 2)

def find_similar_sentences(text1, text2, threshold=0.3):
    """
    Find similar sentences between two texts using sequence matching.
    Handles text extraction issues by cleaning and normalizing the text.
    Uses a lower threshold to capture more matches for complete analysis.
    
    Args:
        text1 (str): Text from first document
        text2 (str): Text from second document
        threshold (float): Similarity threshold (0.0-1.0), lower values find more matches
        
    Returns:
        list: List of dictionaries containing similar sentence pairs
    """
    # Clean and normalize text to improve sentence tokenization
    def clean_text(text):
        # Replace multiple spaces with single space
        text = re.sub(r'\s+', ' ', text)
        # Replace multiple newlines with single newline
        text = re.sub(r'\n+', '\n', text)
        # Remove special characters that might interfere with tokenization
        text = re.sub(r'[^\w\s\.\,\!\?\;\:\"\'\/\(\)\[\]\{\}\-\_\+\=\<\>\@\#\$\%\&\*]', ' ', text)
        return text.strip()
    
    # Clean the texts
    clean_text1 = clean_text(text1)
    clean_text2 = clean_text(text2)
    
    # Try different methods to split into sentences
    def get_sentences(text):
        try:
            # First try NLTK sentence tokenization
            return sent_tokenize(text)
        except Exception:
            try:
                # Fall back to regex-based sentence splitting
                return re.split(r'(?<=[.!?])\s+', text)
            except Exception:
                # Ultimate fallback - split by newlines and periods
                sentences = []
                for line in text.split('\n'):
                    if line.strip():
                        # If line contains multiple sentences, split them
                        if re.search(r'[.!?]', line):
                            sentences.extend([s.strip() + "." for s in re.split(r'(?<=[.!?])\s+', line) if s.strip()])
                        else:
                            sentences.append(line.strip())
                return sentences
    
    # Get sentences using the robust method
    sentences1 = get_sentences(clean_text1)
    sentences2 = get_sentences(clean_text2)
    
    # Also try to break down into smaller chunks for better matching
    def create_smaller_chunks(sentences, chunk_size=30):
        chunks = []
        for sentence in sentences:
            words = sentence.split()
            if len(words) > chunk_size:
                # Create overlapping chunks for longer sentences
                for i in range(0, len(words), chunk_size // 2):
                    if i + chunk_size <= len(words):
                        chunks.append(' '.join(words[i:i+chunk_size]))
            else:
                chunks.append(sentence)
        return chunks
    
    # Create additional smaller chunks for better matching of partial similarities
    additional_chunks1 = create_smaller_chunks(sentences1)
    additional_chunks2 = create_smaller_chunks(sentences2)
    
    # Combine original sentences with smaller chunks
    all_text_units1 = sentences1 + [chunk for chunk in additional_chunks1 if chunk not in sentences1]
    all_text_units2 = sentences2 + [chunk for chunk in additional_chunks2 if chunk not in sentences2]
    
    # Remove very short or empty sentences
    all_text_units1 = [s for s in all_text_units1 if s and len(s.split()) >= 3]
    all_text_units2 = [s for s in all_text_units2 if s and len(s.split()) >= 3]
    
    similar_sentences = []
    
    # Find similar sentence pairs
    for i, s1 in enumerate(all_text_units1):
        for j, s2 in enumerate(all_text_units2):
            # Calculate similarity using SequenceMatcher
            similarity = SequenceMatcher(None, s1, s2).ratio()
            
            if similarity >= threshold:
                similar_sentences.append({
                    "text1_idx": i if i < len(sentences1) else -1,  # Mark as chunk if needed
                    "text1_sentence": s1,
                    "text2_idx": j if j < len(sentences2) else -1,  # Mark as chunk if needed
                    "text2_sentence": s2,
                    "similarity": round(similarity * 100, 2)
                })
    
    # Remove duplicates (keep highest similarity matches)
    unique_matches = {}
    for match in similar_sentences:
        key = (match['text1_sentence'], match['text2_sentence'])
        if key not in unique_matches or unique_matches[key]['similarity'] < match['similarity']:
            unique_matches[key] = match
    
    # Sort by similarity score (highest first)
    return sorted(unique_matches.values(), key=lambda x: x['similarity'], reverse=True)

def generate_similarity_report(file1_path, file2_path, output_path):
    """
    Generate a comprehensive similarity report in PDF format with user-friendly design.
    The report shows side-by-side comparisons of similar content in both documents.
    """
    # Extract text and calculate similarity
    text1 = extract_text_from_file(file1_path)
    text2 = extract_text_from_file(file2_path)
    similarity_score = calculate_similarity_score(text1, text2)
    
    # Use a lower threshold to catch more potential matches
    similar_sentences = find_similar_sentences(text1, text2, threshold=0.3)

    # Create PDF document
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []
    
    # Custom styles matching frontend
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Heading1"],
        fontSize=24,
        alignment=1,
        textColor=colors.HexColor("#0d6efd"),
        spaceAfter=12
    )
    
    # Header Section with improved design
    elements.append(GradientBox(500, 60, colors.HexColor("#E1ECFE"), colors.HexColor("#F0F7FF")))
    elements.append(Spacer(1, -55))  # Negative spacer to position text over the box
    elements.append(Paragraph("Assignment Similarity Detection Report", title_style))
    elements.append(Paragraph(f"Generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", 
                          ParagraphStyle(
                              name="DateStyle",
                              parent=styles["Normal"],
                              alignment=1,  # Center align
                              textColor=colors.HexColor("#555555")
                          )))
    elements.append(Spacer(1, 30))
    
    # Similarity Overview Card with improved styling
    overview_style = TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0d6efd")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 14),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('BACKGROUND', (0,1), (-1,-1), colors.white),
        ('GRID', (0,0), (-1,-1), 1, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#0d6efd")),  # Add a border around the whole table
    ])
    
    # Create similarity visualization
    drawing = Drawing(400, 200)
    pie = Pie()
    pie.x = 150
    pie.y = 50
    pie.width = 150
    pie.height = 150
    pie.data = [similarity_score, 100-similarity_score]
    pie.labels = ["Similar", "Different"]
    pie.slices.strokeWidth = 0.5
    pie.slices[0].fillColor = colors.red if similarity_score >= 75 else \
                             colors.orange if similarity_score >= 50 else \
                             colors.yellow if similarity_score >= 25 else colors.green
    pie.slices[1].fillColor = colors.lightgrey
    drawing.add(pie)
    
    # Similarity stats table
    overview_data = [
        ["Similarity Overview", ""],
        [drawing, 
         f"""<b>Overall Similarity:</b> {similarity_score}%
         <br/><br/>
         <b>Interpretation:</b> {get_interpretation(similarity_score)}
         <br/><br/>
         <b>Comparison Date:</b> {datetime.datetime.now().strftime('%Y-%m-%d')}"""]
    ]
    
    overview_table = Table(overview_data, colWidths=[200, 200])
    overview_table.setStyle(overview_style)
    elements.append(overview_table)
    elements.append(Spacer(1, 24))
    
    # Documents Compared Section
    elements.append(Paragraph("<b>Documents Compared</b>", styles["Heading2"]))
    
    file_data = [
        ["", "Document 1", "Document 2"],
        ["Filename", os.path.basename(file1_path), os.path.basename(file2_path)],
        ["Word Count", str(len(text1.split())), str(len(text2.split()))],
        ["First Submission", get_file_date(file1_path), get_file_date(file2_path)]
    ]
    
    file_table = Table(file_data, colWidths=[100, 150, 150])
    file_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f8f9fa")),
        ('GRID', (0,0), (-1,-1), 1, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ]))
    elements.append(file_table)
    elements.append(Spacer(1, 24))
    
    # Similar Content Analysis
    elements.append(Paragraph("<b>Similar Content Analysis</b>", styles["Heading2"]))
    
    # Always display found similar content, regardless of overall similarity score
    if similar_sentences:
        # Create highlighted text segments
        elements.append(Paragraph("<b>Side-by-Side Content Comparison</b>", styles["Normal"]))
        elements.append(Spacer(1, 12))
        
        # Limit to top 15 matches to avoid excessively long reports
        display_matches = similar_sentences[:15]
        
        elements.append(Paragraph(
            f"Showing top {len(display_matches)} matches out of {len(similar_sentences)} found. Matches are ordered by similarity percentage.", 
            styles["Italic"]
        ))
        elements.append(Spacer(1, 12))
        
        # Create a function to safely truncate text for display if needed
        def safe_truncate(text, max_length=1000):
            """Truncate text if it's too long to safely fit in PDF cells"""
            if len(text) > max_length:
                return text[:max_length] + "... [content truncated for display]"
            return text
        
        for i, match in enumerate(display_matches):
            if i > 0:
                elements.append(Spacer(1, 12))
                elements.append(HorizontalLineFlowable(500))
                elements.append(Spacer(1, 12))
            
            # Create match header with similarity score
            elements.append(
                Paragraph(
                    f"<b>Match #{i+1}</b> - Similarity: {match['similarity']}%", 
                    styles["Heading4"]
                )
            )
            elements.append(Spacer(1, 6))
            
            # Determine color for this match
            similarity = match['similarity']
            if similarity >= 75:
                color_name = "darkred"
                bgcolor = "#FFD6D6"  # Red
            elif similarity >= 50:
                color_name ="darkorange"
                bgcolor = "#FFE8CC"  # Orange
            elif similarity >= 25:
                color_name = "darkgoldenrod"
                bgcolor = "#FFF4CC"   # Yellow
            else:
                color_name = "darkgreen"
                bgcolor = "#D6FFD6"  # Green
            
            # Safely truncate content to prevent overflow
            truncated_text1 = safe_truncate(match['text1_sentence'])
            truncated_text2 = safe_truncate(match['text2_sentence'])
            
            # Split long texts into smaller chunks for better PDF handling
            def split_text_into_chunks(text, max_chars=300):
                """Split text into smaller chunks to improve PDF layout"""
                # If text is already small enough, return as single chunk
                if len(text) <= max_chars:
                    return [text]
                
                chunks = []
                # Try to split at sentence boundaries first
                sentences = re.split(r'(?<=[.!?])\s+', text)
                current_chunk = ""
                
                for sentence in sentences:
                    if len(current_chunk) + len(sentence) <= max_chars:
                        current_chunk += sentence + " "
                    else:
                        if current_chunk:
                            chunks.append(current_chunk.strip())
                        
                        # If sentence itself is longer than max_chars, we need to split it
                        if len(sentence) > max_chars:
                            # Split at word boundaries
                            words = sentence.split()
                            current_chunk = ""
                            for word in words:
                                if len(current_chunk) + len(word) + 1 <= max_chars:
                                    current_chunk += word + " "
                                else:
                                    chunks.append(current_chunk.strip())
                                    current_chunk = word + " "
                            
                            if current_chunk:
                                chunks.append(current_chunk.strip())
                            current_chunk = ""
                        else:
                            current_chunk = sentence + " "
                
                if current_chunk:
                    chunks.append(current_chunk.strip())
                
                return chunks
            
            # Split each text into manageable chunks
            text1_chunks = split_text_into_chunks(truncated_text1)
            text2_chunks = split_text_into_chunks(truncated_text2)
            
            # Ensure we have equal numbers of chunks for display alignment
            max_chunks = max(len(text1_chunks), len(text2_chunks))
            text1_chunks = text1_chunks + [""] * (max_chunks - len(text1_chunks))
            text2_chunks = text2_chunks + [""] * (max_chunks - len(text2_chunks))
            
            # Now create a table with the chunks as rows
            match_data = [
                [f"<b>{os.path.basename(file1_path)}</b>", f"<b>{os.path.basename(file2_path)}</b>"]
            ]
            
            # Add each pair of chunks as a row
            for t1_chunk, t2_chunk in zip(text1_chunks, text2_chunks):
                # Create styled paragraphs for each chunk
                p1 = Paragraph(t1_chunk, 
                               ParagraphStyle(
                                   name="Chunk1",
                                   parent=styles["Normal"],
                                   backColor=bgcolor,
                                   textColor=getattr(colors, color_name),
                                   wordWrap='CJK'  # Better word wrapping
                               ))
                p2 = Paragraph(t2_chunk, 
                               ParagraphStyle(
                                   name="Chunk2", 
                                   parent=styles["Normal"],
                                   backColor=bgcolor,
                                   textColor=getattr(colors, color_name),
                                   wordWrap='CJK'  # Better word wrapping
                               ))
                
                match_data.append([p1, p2])
            
            # Create the table with all content rows
            match_table = Table(match_data, colWidths=[240, 240])
            match_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (1,0), colors.HexColor("#f8f9fa")),  # Header row bg
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
                ('PADDING', (0,0), (-1,-1), 6),
                # Setting split to handle row splitting across pages for large matches
                ('ROWSPLITRANGE', (0,1), (-1,-1)),  # Allow splitting rows across pages
                ('VALIGN', (0,0), (-1,-1), 'TOP')  # Align all content to top
            ]))
            
            elements.append(match_table)
            
            # Add similarity score as a footer for this match section
            elements.append(Spacer(1, 6))
            elements.append(
                Paragraph(
                    f"<i>Similarity score: {match['similarity']}%</i>",
                    ParagraphStyle(
                        name="Similarity",
                        parent=styles["Italic"],
                        alignment=1  # Center alignment
                    )
                )
            )
            
            # Add a page break after each match if needed
            if i < len(display_matches) - 1:
                elements.append(PageBreak())
    else:
        # Only show placeholders if no matches found
        if similarity_score > 0:
            elements.append(Paragraph(
                f"The documents have an overall similarity score of {similarity_score}%, but no specific matching phrases were identified at the current threshold.",
                styles["Normal"]))
            elements.append(Spacer(1, 12))
            elements.append(Paragraph(
                "Try adjusting the threshold in the find_similar_sentences function to detect more subtle similarities.",
                styles["Normal"]))
        else:
            elements.append(Paragraph("No significant similar content found.", styles["Normal"]))
    
    elements.append(Spacer(1, 24))
    
    # Highlighting Legend
    elements.append(Paragraph("<b>Highlighting Legend</b>", styles["Heading2"]))
    
    legend_data = [
        ["75-100% Similarity (High)", "50-74% Similarity (Medium)", "25-49% Similarity (Low)", "0-24% Similarity (Minimal)"],
        [Rect(0,0,20,20, fillColor=colors.red), 
         Rect(0,0,20,20, fillColor=colors.orange), 
         Rect(0,0,20,20, fillColor=colors.yellow), 
         Rect(0,0,20,20, fillColor=colors.green)]
    ]
    
    legend_table = Table(legend_data, colWidths=[120,120,120,120])
    legend_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE')
    ]))
    elements.append(legend_table)
    
    # Footer
    elements.append(Spacer(1, 24))
    elements.append(Paragraph("<i>This report is generated automatically. Please review findings carefully.</i>", 
                            styles["Italic"]))
    elements.append(Paragraph("<i>Generated by Academic Integrity System</i>", 
                            styles["Italic"]))
    
    # Build the PDF - add catch for document build errors
    try:
        doc.build(elements)
    except Exception as e:
        print(f"Error building document: {e}")
        # Fallback to a simpler report if complex one fails
        generate_simple_report(file1_path, file2_path, output_path, similarity_score, similar_sentences)
    
    return output_path

def generate_simple_report(file1_path, file2_path, output_path, similarity_score, similar_sentences):
    """
    Generate a simplified report when the full report fails.
    This provides a basic report without the complex formatting that might cause errors.
    """
    doc = SimpleDocTemplate(output_path, pagesize=A4)
    styles = getSampleStyleSheet()
    elements = []
    
    # Basic header
    elements.append(Paragraph("Similarity Report (Simplified Version)", styles["Title"]))
    elements.append(Paragraph(f"Generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles["Normal"]))
    elements.append(Spacer(1, 20))
    
    # Basic similarity info
    elements.append(Paragraph(f"Overall Similarity Score: {similarity_score}%", styles["Heading2"]))
    elements.append(Paragraph(f"Interpretation: {get_interpretation(similarity_score)}", styles["Normal"]))
    elements.append(Spacer(1, 20))
    
    # Files compared
    elements.append(Paragraph("Documents Compared", styles["Heading2"]))
    elements.append(Paragraph(f"Document 1: {os.path.basename(file1_path)}", styles["Normal"]))
    elements.append(Paragraph(f"Document 2: {os.path.basename(file2_path)}", styles["Normal"]))
    elements.append(Spacer(1, 20))
    
    # Similar content (simplified)
    elements.append(Paragraph("Similar Content", styles["Heading2"]))
    
    if similar_sentences:
        # Limit to top 10 matches
        display_matches = similar_sentences[:10]
        
        for i, match in enumerate(display_matches):
            elements.append(Paragraph(f"Match #{i+1} - Similarity: {match['similarity']}%", styles["Heading3"]))
            elements.append(Paragraph("Document 1:", styles["Heading4"]))
            
            # Safely truncate to prevent overflow
            doc1_text = match['text1_sentence']
            if len(doc1_text) > 500:
                doc1_text = doc1_text[:500] + "... [truncated]"
            
            elements.append(Paragraph(doc1_text, styles["Normal"]))
            elements.append(Spacer(1, 10))
            
            elements.append(Paragraph("Document 2:", styles["Heading4"]))
            
            doc2_text = match['text2_sentence']
            if len(doc2_text) > 500:
                doc2_text = doc2_text[:500] + "... [truncated]"
                
            elements.append(Paragraph(doc2_text, styles["Normal"]))
            elements.append(Spacer(1, 20))
    else:
        elements.append(Paragraph("No significant similar content found.", styles["Normal"]))
    
    # Footer
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Note: This is a simplified report generated because the detailed report encountered formatting issues.", styles["Italic"]))
    
    # Build the PDF
    doc.build(elements)


def calculate_similarity(file1_path, file2_path):
    """
    Calculate the similarity between two files and generate a detailed report.
    Returns a dictionary with similarity score and report path.
    """
    # Ensure the output directory exists
    reports_dir = os.path.join('media', 'similarity_reports')
    os.makedirs(reports_dir, exist_ok=True)
    
    # Generate a unique filename for the report
    report_filename = get_report_filename(file1_path, file2_path)
    output_path = os.path.join(reports_dir, report_filename)
    
    # Generate the report
    try:
        report_path = generate_similarity_report(file1_path, file2_path, output_path)
        
        # Extract text from files for basic similarity score
        text1 = extract_text_from_file(file1_path)
        text2 = extract_text_from_file(file2_path)
        
        # Calculate similarity score
        preprocessed_text1 = preprocess_text(text1)
        preprocessed_text2 = preprocess_text(text2)
        
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform([preprocessed_text1, preprocessed_text2])
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]
        
        return {
            'similarity_score': round(similarity * 100, 2),
            'report_path': report_path,
            'report_filename': report_filename
        }
    except Exception as e:
        print(f"Error generating similarity report: {e}")
        return {
            'similarity_score': 0,
            'error': str(e),
            'report_path': None,
            'report_filename': None
        }
        
