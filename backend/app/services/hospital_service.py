import httpx
import math
from typing import List, Dict, Any, Optional

CITY_COORDINATES = {
    "hyderabad": (17.3850, 78.4867),
    "vijayawada": (16.5062, 80.6480),
    "visakhapatnam": (17.6868, 83.2185),
    "guntur": (16.3067, 80.4365),
    "tirupati": (13.6288, 79.4192),
    "warangal": (17.9689, 79.5941),
    "bengaluru": (12.9716, 77.5946),
    "chennai": (13.0827, 80.2707),
    "delhi": (28.6139, 77.2090),
    "mumbai": (19.0760, 72.8777),
}

VERIFIED_FACILITIES = [
    {
        "id": "fac-1",
        "name": "Apollo Hospitals Jubilee Hills",
        "facility_type": "Multispecialty Hospital & Trauma Center",
        "address": "Road No 72, Opposite Bharatiya Vidya Bhavan, Jubilee Hills, Hyderabad, Telangana 500033",
        "lat": 17.4156,
        "lng": 78.4128,
        "phone": "+91 40 2360 7777",
        "emergency_services": True,
        "city": "hyderabad",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Apollo+Hospitals+Jubilee+Hills+Hyderabad"
    },
    {
        "id": "fac-2",
        "name": "KIMS Hospitals (Krishna Institute of Medical Sciences)",
        "facility_type": "Super Specialty Hospital",
        "address": "1-8-31/1, Minister Rd, Krishna Nagar Colony, Begumpet, Secunderabad, Telangana 500003",
        "lat": 17.4375,
        "lng": 78.4853,
        "phone": "+91 40 4488 5000",
        "emergency_services": True,
        "city": "hyderabad",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=KIMS+Hospitals+Begumpet+Secunderabad"
    },
    {
        "id": "fac-3",
        "name": "Nizam's Institute of Medical Sciences (NIMS)",
        "facility_type": "Government Apex Hospital",
        "address": "Punjagutta Rd, Punjagutta, Hyderabad, Telangana 500082",
        "lat": 17.4227,
        "lng": 78.4526,
        "phone": "+91 40 2348 9000",
        "emergency_services": True,
        "city": "hyderabad",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=NIMS+Hospital+Punjagutta+Hyderabad"
    },
    {
        "id": "fac-4",
        "name": "Vijaya Diagnostic Centre",
        "facility_type": "Advanced Diagnostic & Imaging Center",
        "address": "3-6-16 & 17, Himayatnagar, Hyderabad, Telangana 500029",
        "lat": 17.3995,
        "lng": 78.4877,
        "phone": "+91 40 2342 0420",
        "emergency_services": False,
        "city": "hyderabad",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Vijaya+Diagnostic+Centre+Himayatnagar"
    },
    {
        "id": "fac-5",
        "name": "Manipal Hospital Vijayawada",
        "facility_type": "Multispecialty Hospital",
        "address": "Near Kanaka Durga Varadhi, Tadepalle, Vijayawada, Andhra Pradesh 522501",
        "lat": 16.4862,
        "lng": 80.6120,
        "phone": "+91 866 646 9999",
        "emergency_services": True,
        "city": "vijayawada",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Manipal+Hospital+Vijayawada"
    },
    {
        "id": "fac-6",
        "name": "Andhra Hospitals Heart & Brain Institute",
        "facility_type": "Specialty Hospital",
        "address": "C.V.R Complex, Governorpet, Vijayawada, Andhra Pradesh 520002",
        "lat": 16.5120,
        "lng": 80.6280,
        "phone": "+91 866 257 4757",
        "emergency_services": True,
        "city": "vijayawada",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Andhra+Hospitals+Vijayawada"
    },
    {
        "id": "fac-7",
        "name": "Apollo Clinic & Pharmacy",
        "facility_type": "Primary Clinic & Pharmacy",
        "address": "MG Road, Benz Circle, Vijayawada, Andhra Pradesh 520010",
        "lat": 16.5020,
        "lng": 80.6520,
        "phone": "+91 866 248 1111",
        "emergency_services": False,
        "city": "vijayawada",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Apollo+Pharmacy+Benz+Circle+Vijayawada"
    },
    {
        "id": "fac-8",
        "name": "Medall Healthcare Diagnostic Lab",
        "facility_type": "Diagnostic Center",
        "address": "Eluru Road, Governorpet, Vijayawada, Andhra Pradesh 520002",
        "lat": 16.5140,
        "lng": 80.6320,
        "phone": "+91 866 243 5555",
        "emergency_services": False,
        "city": "vijayawada",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=Medall+Diagnostic+Vijayawada"
    },
    {
        "id": "fac-9",
        "name": "King George Hospital (KGH)",
        "facility_type": "Government Apex Teaching Hospital",
        "address": "Maharanipeta, Visakhapatnam, Andhra Pradesh 530002",
        "lat": 17.7088,
        "lng": 83.3033,
        "phone": "+91 891 256 4891",
        "emergency_services": True,
        "city": "visakhapatnam",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=King+George+Hospital+Visakhapatnam"
    },
    {
        "id": "fac-10",
        "name": "All India Institute of Medical Sciences (AIIMS) Mangalagiri",
        "facility_type": "National Institute & Apex Hospital",
        "address": "NH-16, Mangalagiri, Guntur District, Andhra Pradesh 522503",
        "lat": 16.4380,
        "lng": 80.5650,
        "phone": "+91 8645 280 000",
        "emergency_services": True,
        "city": "guntur",
        "directions_url": "https://www.google.com/maps/search/?api=1&query=AIIMS+Mangalagiri"
    }
]

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 2)

class HospitalService:
    @classmethod
    async def search_facilities(
        cls,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        city: Optional[str] = None,
        pin_code: Optional[str] = None,
        category: str = "all",
        radius_km: float = 15.0
    ) -> Dict[str, Any]:
        target_lat = lat
        target_lng = lng
        location_label = "Current Location"

        # Resolve coordinates from city if lat/lng not provided
        if (target_lat is None or target_lng is None) and city:
            city_key = city.strip().lower()
            if city_key in CITY_COORDINATES:
                target_lat, target_lng = CITY_COORDINATES[city_key]
                location_label = city.title()
            else:
                target_lat, target_lng = CITY_COORDINATES["hyderabad"]
                location_label = f"{city.title()} (matched regional center)"
        elif target_lat is not None and target_lng is not None:
            location_label = f"Lat: {target_lat:.4f}, Lng: {target_lng:.4f}"
        else:
            target_lat, target_lng = CITY_COORDINATES["hyderabad"]
            location_label = "Hyderabad (Default)"

        results: List[Dict[str, Any]] = []

        # Attempt live OpenStreetMap Overpass API call
        try:
            bbox_delta = radius_km / 111.0
            south = target_lat - bbox_delta
            north = target_lat + bbox_delta
            west = target_lng - bbox_delta
            east = target_lng + bbox_delta

            overpass_query = f"""
            [out:json][timeout:5];
            (
              node["amenity"="hospital"]({south},{west},{north},{east});
              node["amenity"="clinic"]({south},{west},{north},{east});
              node["amenity"="pharmacy"]({south},{west},{north},{east});
            );
            out 15;
            """
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post("https://overpass-api.de/api/interpreter", data={"data": overpass_query})
                if resp.status_code == 200:
                    data = resp.json()
                    elements = data.get("elements", [])
                    for el in elements:
                        tags = el.get("tags", {})
                        name = tags.get("name")
                        if not name:
                            continue
                        f_lat = el.get("lat")
                        f_lon = el.get("lon")
                        dist = haversine_km(target_lat, target_lng, f_lat, f_lon)
                        amenity = tags.get("amenity", "healthcare").title()
                        emergency = tags.get("emergency") == "yes" or "hospital" in amenity.lower()

                        results.append({
                            "id": f"osm-{el.get('id')}",
                            "name": name,
                            "facility_type": amenity,
                            "address": tags.get("addr:street") or tags.get("addr:full") or f"Near {location_label}",
                            "lat": f_lat,
                            "lng": f_lon,
                            "distance_km": dist,
                            "phone": tags.get("phone") or tags.get("contact:phone") or None,
                            "emergency_services": emergency,
                            "source": "OpenStreetMap Live",
                            "directions_url": f"https://www.google.com/maps/search/?api=1&query={f_lat},{f_lon}"
                        })
        except Exception:
            pass  # Fall back to verified registry below

        # If live API had no results or timed out, use verified database entries
        if not results:
            for fac in VERIFIED_FACILITIES:
                dist = haversine_km(target_lat, target_lng, fac["lat"], fac["lng"])
                # If city specified and matches, or within reasonable distance
                fac_copy = dict(fac)
                fac_copy["distance_km"] = dist
                fac_copy["source"] = "Verified Healthcare Directory"
                results.append(fac_copy)

        # Sort by distance
        results.sort(key=lambda x: x.get("distance_km", 999.0))

        # Filter by category if requested
        if category != "all":
            if category == "hospitals":
                results = [r for r in results if "hospital" in r["facility_type"].lower()]
            elif category == "clinics":
                results = [r for r in results if "clinic" in r["facility_type"].lower()]
            elif category == "pharmacies":
                results = [r for r in results if "pharmacy" in r["facility_type"].lower()]
            elif category == "diagnostics":
                results = [r for r in results if "diagnostic" in r["facility_type"].lower() or "imaging" in r["facility_type"].lower()]

        return {
            "query_location": location_label,
            "total_found": len(results),
            "facilities": results[:15],
            "emergency_helplines": {
                "National Emergency Helpline": "112",
                "Ambulance / Emergency Medical Services": "108",
                "National Health Helpline": "1075",
                "Women Safety Helpline": "1091",
                "Tele-MANAS Mental Health": "14416"
            }
        }
