import fitz  # PyMuPDF
from typing import List, Dict, Any
import os

class DocumentParser:
    """Service to parse PDFs and extract text and layout-based metadata."""
    
    @staticmethod
    def parse_pdf(file_path: str) -> List[Dict[str, Any]]:
        """
        Parses a PDF file into chunks (pages) with structural headers.
        
        Args:
            file_path: Absolute path to the PDF file.
            
        Returns:
            A list of dictionaries representing chunks:
            [{"page": 1, "section": "Chapter 1", "text": "..."}]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        doc = fitz.open(file_path)
        chunks = []
        current_section = "Document Header"

        for page_num in range(len(doc)):
            page = doc[page_num]
            text = page.get_text("text").strip()
            
            # Heuristic to look for headers on this page
            # We look at the blocks and identify short, prominent lines
            blocks = page.get_text("blocks")
            for block in blocks:
                block_text = block[4].strip()
                lines = [line.strip() for line in block_text.split('\n') if line.strip()]
                if not lines:
                    continue
                
                first_line = lines[0]
                # If first line of the block is short, doesn't end with a period,
                # and is either all caps or starts with numbers/section patterns:
                if len(first_line) < 80 and not first_line.endswith('.') and (
                    first_line.isupper() or 
                    first_line[0].isdigit() or 
                    any(first_line.lower().startswith(p) for p in ["chapter", "section", "appendix", "part"])
                ):
                    current_section = first_line
                    break  # Use the first major heading found on this page

            # Only append chunks that have actual readable text
            if text:
                chunks.append({
                    "page_number": page_num + 1,
                    "section_header": current_section,
                    "text": text
                })

        return chunks
