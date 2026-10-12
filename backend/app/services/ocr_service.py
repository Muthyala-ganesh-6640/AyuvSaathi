import os
import re
import fitz  # PyMuPDF
from PIL import Image
import numpy as np
import cv2
from typing import Dict, Any, List, Optional

class OCRService:
    @staticmethod
    def extract_text_from_pdf(file_path: str) -> str:
        text_content = []
        try:
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                if text.strip():
                    text_content.append(text)
            doc.close()
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
        return "\n".join(text_content)

    @staticmethod
    def preprocess_image(file_path: str) -> np.ndarray:
        # Load image with OpenCV
        img = cv2.imread(file_path)
        if img is None:
            pil_img = Image.open(file_path)
            img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Contrast adjustment (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        contrast_enhanced = clahe.apply(gray)
        
        # Adaptive thresholding / Denoise
        denoised = cv2.fastNlMeansDenoising(contrast_enhanced, None, 10, 7, 21)
        return denoised

    @classmethod
    def extract_text(cls, file_path: str, mime_type: str) -> str:
        if "pdf" in mime_type.lower() or file_path.lower().endswith(".pdf"):
            pdf_text = cls.extract_text_from_pdf(file_path)
            if pdf_text.strip():
                return pdf_text
        
        # If it's an image or scanned PDF
        try:
            import pytesseract
            processed = cls.preprocess_image(file_path)
            return pytesseract.image_to_string(processed)
        except Exception:
            # Fallback text extractor if tesseract binary is not installed on system path
            return ""

    @staticmethod
    def parse_lab_parameters(text: str) -> List[Dict[str, Any]]:
        results = []
        
        # Known common laboratory reference profiles
        common_tests = [
            {"name": "Hemoglobin", "regex": r"(?:Hemoglobin|Hb|HGB)[\s:]+([0-9\.]+)\s*(g/dL|g/dl|gm/dl)?", "unit": "g/dL", "min": 12.0, "max": 17.5},
            {"name": "Fasting Blood Sugar", "regex": r"(?:Fasting Blood Sugar|FBS|Glucose Fasting|Glucose, Fasting)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 70.0, "max": 99.0},
            {"name": "Post Prandial Blood Sugar", "regex": r"(?:PPBS|Post Prandial|Glucose PP)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 70.0, "max": 140.0},
            {"name": "HbA1c", "regex": r"(?:HbA1c|Glycated Hemoglobin)[\s:]+([0-9\.]+)\s*(%|percent)?", "unit": "%", "min": 4.0, "max": 5.6},
            {"name": "Total Cholesterol", "regex": r"(?:Total Cholesterol|Cholesterol, Total)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 125.0, "max": 200.0},
            {"name": "HDL Cholesterol", "regex": r"(?:HDL Cholesterol|HDL)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 40.0, "max": 60.0},
            {"name": "LDL Cholesterol", "regex": r"(?:LDL Cholesterol|LDL)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 50.0, "max": 100.0},
            {"name": "Triglycerides", "regex": r"(?:Triglycerides|TGL)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 50.0, "max": 150.0},
            {"name": "Serum Creatinine", "regex": r"(?:Serum Creatinine|Creatinine)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 0.6, "max": 1.2},
            {"name": "Blood Urea Nitrogen", "regex": r"(?:BUN|Blood Urea)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 7.0, "max": 20.0},
            {"name": "Total WBC Count", "regex": r"(?:WBC|Total Leucocyte Count|TLC)[\s:]+([0-9\.]+)\s*(\/cu\.mm|cells\/cumm|10\^3\/uL)?", "unit": "cells/cumm", "min": 4000.0, "max": 11000.0},
            {"name": "Platelet Count", "regex": r"(?:Platelet Count|Platelets)[\s:]+([0-9\.]+)\s*(lakhs\/cumm|10\^3\/uL|\/cumm)?", "unit": "10^3/uL", "min": 150.0, "max": 450.0},
            {"name": "Serum Bilirubin Total", "regex": r"(?:Bilirubin Total|Total Bilirubin)[\s:]+([0-9\.]+)\s*(mg/dL|mg/dl)?", "unit": "mg/dL", "min": 0.2, "max": 1.2},
            {"name": "SGPT (ALT)", "regex": r"(?:SGPT|ALT)[\s:]+([0-9\.]+)\s*(U/L|IU/L)?", "unit": "U/L", "min": 7.0, "max": 56.0},
            {"name": "SGOT (AST)", "regex": r"(?:SGOT|AST)[\s:]+([0-9\.]+)\s*(U/L|IU/L)?", "unit": "U/L", "min": 10.0, "max": 40.0},
            {"name": "Thyroid Stimulating Hormone (TSH)", "regex": r"(?:TSH|Thyroid Stimulating Hormone)[\s:]+([0-9\.]+)\s*(uIU/mL|uIU/ml|mIU/L)?", "unit": "uIU/mL", "min": 0.4, "max": 4.5},
            {"name": "Vitamin D3 (25-OH)", "regex": r"(?:Vitamin D|25-OH Vitamin D)[\s:]+([0-9\.]+)\s*(ng/mL|ng/ml)?", "unit": "ng/mL", "min": 30.0, "max": 100.0},
            {"name": "Vitamin B12", "regex": r"(?:Vitamin B12|B12)[\s:]+([0-9\.]+)\s*(pg/mL|pg/ml)?", "unit": "pg/mL", "min": 200.0, "max": 900.0},
        ]

        # Scan text for test patterns
        for test in common_tests:
            match = re.search(test["regex"], text, re.IGNORECASE)
            if match:
                try:
                    val_str = match.group(1)
                    val_float = float(val_str)
                    unit = match.group(2) if len(match.groups()) >= 2 and match.group(2) else test["unit"]
                    ref_range = f"{test['min']} - {test['max']} {test['unit']}"
                    
                    is_abnormal = False
                    abnormal_flag = "NORMAL"
                    if val_float < test["min"]:
                        is_abnormal = True
                        abnormal_flag = "LOW"
                    elif val_float > test["max"]:
                        is_abnormal = True
                        abnormal_flag = "HIGH"

                    results.append({
                        "test_name": test["name"],
                        "measured_value": val_str,
                        "numeric_value": val_float,
                        "unit": unit,
                        "reference_range": ref_range,
                        "is_abnormal": is_abnormal,
                        "abnormal_flag": abnormal_flag,
                        "notes": "Extracted via OCR/pattern recognition. Please verify against original report."
                    })
                except Exception:
                    continue

        return results

    @staticmethod
    def parse_prescription_items(text: str) -> List[Dict[str, Any]]:
        items = []
        
        # Patterns for common medicines and dosage structures
        med_patterns = [
            {"name": "Metformin", "regex": r"(?:Metformin|Glycomet)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Twice daily after meals", "route": "oral"},
            {"name": "Telmisartan", "regex": r"(?:Telmisartan|Telma)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Once daily in the morning", "route": "oral"},
            {"name": "Atorvastatin", "regex": r"(?:Atorvastatin|Atorva|Lipitor)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Once daily at bedtime", "route": "oral"},
            {"name": "Amlodipine", "regex": r"(?:Amlodipine|Amlong)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Once daily in the morning", "route": "oral"},
            {"name": "Pantoprazole", "regex": r"(?:Pantoprazole|Pan[\s\-]*40)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Once daily before breakfast", "route": "oral"},
            {"name": "Amoxicillin", "regex": r"(?:Amoxicillin|Mox|Augmentin)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Three times daily for 5 days", "route": "oral"},
            {"name": "Azithromycin", "regex": r"(?:Azithromycin|Azee|Zithromax)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "Once daily for 3 days", "route": "oral"},
            {"name": "Paracetamol", "regex": r"(?:Paracetamol|Dolo|Calpol)[\s\-]*([0-9]+(?:\s*mg)?)", "default_freq": "As needed every 6 hours for fever", "route": "oral"},
            {"name": "Levothyroxine", "regex": r"(?:Levothyroxine|Thyronorm|Eltroxin)[\s\-]*([0-9]+(?:\s*mcg|\s*ug)?)", "default_freq": "Once daily early morning empty stomach", "route": "oral"},
            {"name": "Vitamin D3 Cholecalciferol", "regex": r"(?:Vitamin D3|Cholecalciferol|Uprise[\s\-]*D3)[\s\-]*([0-9]+(?:\s*k|\s*IU)?)", "default_freq": "Once weekly with milk", "route": "oral"},
        ]

        for med in med_patterns:
            match = re.search(med["regex"], text, re.IGNORECASE)
            if match:
                dosage = match.group(1) if match.group(1) else "500 mg"
                if not any(u in dosage.lower() for u in ["mg", "mcg", "iu", "k", "gm"]):
                    dosage = f"{dosage} mg"
                
                # Check for frequency keywords in proximity
                freq = med["default_freq"]
                if "1-0-1" in text:
                    freq = "Twice daily (1-0-1)"
                elif "1-0-0" in text:
                    freq = "Once daily morning (1-0-0)"
                elif "0-0-1" in text:
                    freq = "Once daily night (0-0-1)"
                elif "1-1-1" in text:
                    freq = "Three times daily (1-1-1)"

                items.append({
                    "medicine_name": med["name"],
                    "dosage": dosage,
                    "route": med["route"],
                    "frequency": freq,
                    "duration": "30 days",
                    "instructions": "Take as directed by doctor. Do not alter dose without consultation.",
                    "is_verified": False
                })

        return items
