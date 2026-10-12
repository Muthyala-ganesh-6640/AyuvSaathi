from typing import Dict, Any, List
from datetime import datetime

class FHIRService:
    @staticmethod
    def map_patient(patient_model) -> Dict[str, Any]:
        return {
            "resourceType": "Patient",
            "id": patient_model.id,
            "identifier": [
                {
                    "system": "https://healthid.ndhm.gov.in",
                    "value": patient_model.abha_id or "91-1234-5678-9012"
                }
            ],
            "name": [
                {
                    "use": "official",
                    "text": patient_model.full_name
                }
            ],
            "gender": (patient_model.gender or "unknown").lower(),
            "birthDate": patient_model.date_of_birth or "1980-01-01",
            "telecom": [
                {
                    "system": "phone",
                    "value": patient_model.phone or "+91 98765 43210"
                }
            ],
            "address": [
                {
                    "use": "home",
                    "text": patient_model.address or "Telangana / Andhra Pradesh, India"
                }
            ]
        }

    @staticmethod
    def map_observation(lab_model) -> Dict[str, Any]:
        obs = {
            "resourceType": "Observation",
            "id": lab_model.id,
            "status": "final" if lab_model.verification_status == "verified" else "preliminary",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "laboratory",
                            "display": "Laboratory"
                        }
                    ]
                }
            ],
            "code": {
                "text": lab_model.test_name
            },
            "subject": {
                "reference": f"Patient/{lab_model.patient_id}"
            },
            "effectiveDateTime": lab_model.test_date or datetime.utcnow().isoformat(),
            "interpretation": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation",
                            "code": "H" if lab_model.abnormal_flag == "HIGH" else "L" if lab_model.abnormal_flag == "LOW" else "N",
                            "display": lab_model.abnormal_flag or "Normal"
                        }
                    ]
                }
            ]
        }
        if lab_model.numeric_value is not None:
            obs["valueQuantity"] = {
                "value": lab_model.numeric_value,
                "unit": lab_model.unit or "",
                "system": "http://unitsofmeasure.org"
            }
        else:
            obs["valueString"] = lab_model.measured_value

        if lab_model.reference_range:
            obs["referenceRange"] = [
                {
                    "text": lab_model.reference_range
                }
            ]
        return obs

    @staticmethod
    def map_medication_request(prescription_item_model, patient_id: str) -> Dict[str, Any]:
        return {
            "resourceType": "MedicationRequest",
            "id": prescription_item_model.id,
            "status": "active",
            "intent": "order",
            "medicationCodeableConcept": {
                "text": prescription_item_model.medicine_name
            },
            "subject": {
                "reference": f"Patient/{patient_id}"
            },
            "dosageInstruction": [
                {
                    "text": f"{prescription_item_model.dosage}, {prescription_item_model.frequency}",
                    "route": {
                        "text": prescription_item_model.route or "oral"
                    }
                }
            ]
        }

    @staticmethod
    def map_care_plan(plan_model) -> Dict[str, Any]:
        return {
            "resourceType": "CarePlan",
            "id": plan_model.id,
            "status": plan_model.status,
            "intent": "plan",
            "title": plan_model.title,
            "description": plan_model.treatment_instructions,
            "subject": {
                "reference": f"Patient/{plan_model.patient_id}"
            },
            "period": {
                "start": plan_model.start_date,
                "end": plan_model.end_date
            }
        }

    @classmethod
    def generate_patient_bundle(cls, patient, labs, meds, plans) -> Dict[str, Any]:
        entries = []
        entries.append({"resource": cls.map_patient(patient)})
        for lab in labs:
            entries.append({"resource": cls.map_observation(lab)})
        for med in meds:
            entries.append({"resource": cls.map_medication_request(med, patient.id)})
        for plan in plans:
            entries.append({"resource": cls.map_care_plan(plan)})

        return {
            "resourceType": "Bundle",
            "type": "collection",
            "timestamp": datetime.utcnow().isoformat(),
            "total": len(entries),
            "entry": entries
        }
