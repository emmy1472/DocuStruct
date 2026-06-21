import fitz
from src.pipeline.parser import DocumentParser
from src.pipeline.extractor import AIExtractor
import asyncio
import os

def generate_mock_pdf(filename: str):
    """Programmatically generates a mock PDF manual for testing the pipeline."""
    print(f"Generating mock PDF: {filename}...")
    doc = fitz.open()
    
    # Page 1: Chapter 1
    page1 = doc.new_page()
    page1.insert_text((50, 50), "CHAPTER 1: SYSTEM OVERVIEW", fontsize=16, color=(0.1, 0.2, 0.5))
    
    description_text = (
        "The CoreProcessor is the central controller of the ACME System. "
        "It manages operational state and depends on the PowerModulator to regulate voltages. "
        "The operator interacts with the system using the ControlPanel component."
    )
    page1.insert_textbox((50, 80, 500, 200), description_text, fontsize=11)
    
    # Page 2: Chapter 2
    page2 = doc.new_page()
    page2.insert_text((50, 50), "CHAPTER 2: ELECTRICAL SPECIFICATION", fontsize=16, color=(0.1, 0.2, 0.5))
    
    limits_intro = "The ACME CoreProcessor has explicit electrical limits shown below."
    page2.insert_textbox((50, 80, 500, 120), limits_intro, fontsize=11)
    
    # Draw simple table border
    page2.draw_rect((50, 130, 450, 230), color=(0.3, 0.3, 0.3), width=1)
    page2.draw_line((50, 160), (450, 160), color=(0.3, 0.3, 0.3), width=1)
    page2.draw_line((250, 130), (250, 230), color=(0.3, 0.3, 0.3), width=1)
    
    # Insert Table Headers
    page2.insert_text((60, 148), "Parameter Name", fontsize=10)
    page2.insert_text((260, 148), "Maximum Rating", fontsize=10)
    
    # Insert Table Rows
    page2.insert_text((60, 180), "Input Voltage", fontsize=10)
    page2.insert_text((260, 180), "5.5 Volts Direct Current", fontsize=10)
    
    page2.insert_text((60, 210), "Operational Temp", fontsize=10)
    page2.insert_text((260, 210), "85 Degrees Celsius", fontsize=10)
    
    doc.save(filename)
    doc.close()
    print("Mock PDF manual created successfully.\n")

async def main():
    pdf_filename = "test_manual.pdf"
    generate_mock_pdf(pdf_filename)
    
    # 1. Run local parser
    print("--- Testing Document Parser ---")
    chunks = DocumentParser.parse_pdf(pdf_filename)
    for chunk in chunks:
        print(f"Page: {chunk['page_number']}")
        print(f"Identified Section Header: {chunk['section_header']}")
        print(f"Content Snippet: {chunk['text'][:150]}...")
        print("-" * 30)
        
    # 2. Test mock extraction / embedding pipeline
    print("\n--- Testing AI Embeddings & Structural Extraction (Mock Mode) ---")
    extractor = AIExtractor()
    
    # Generating a mock embedding (which doesn't require API key if mock mode runs)
    print("Generating embedding vector...")
    embedding = await extractor.get_embedding("Testing Gemini Embedding API")
    print(f"Embedding dimensions: {len(embedding)} (Success!)")
    
    # Extracting structured entities
    print("Running Pydantic-validated extraction...")
    extraction = await extractor.extract_structured_data(
        text=chunks[0]["text"],
        page_number=chunks[0]["page_number"],
        section_header=chunks[0]["section_header"]
    )
    print("\nStructured JSON Output Result:")
    print(extraction.model_dump_json(indent=2))
    
    # Clean up mock file
    if os.path.exists(pdf_filename):
        os.remove(pdf_filename)
        print("\nCleaned up mock manual.")

if __name__ == "__main__":
    asyncio.run(main())
