from fastapi import APIRouter, Depends, Query
from typing import Optional

from backend.app.schemas.schemas import HospitalSearchResponse
from backend.app.services.hospital_service import HospitalService

router = APIRouter(prefix="/hospitals", tags=["Nearby Hospitals and Clinics"])

@router.get("/search", response_model=HospitalSearchResponse)
async def search_nearby_facilities(
    lat: Optional[float] = Query(None, description="Latitude"),
    lng: Optional[float] = Query(None, description="Longitude"),
    city: Optional[str] = Query(None, description="City name (e.g. Hyderabad, Vijayawada)"),
    pin_code: Optional[str] = Query(None, description="Postal PIN code"),
    category: Optional[str] = Query("all", description="Facility type: all, hospitals, clinics, pharmacies, diagnostics"),
    radius_km: Optional[float] = Query(15.0, description="Search radius in kilometers")
):
    results = await HospitalService.search_facilities(
        lat=lat,
        lng=lng,
        city=city,
        pin_code=pin_code,
        category=category or "all",
        radius_km=radius_km or 15.0
    )
    return results
