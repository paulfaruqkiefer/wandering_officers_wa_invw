import geopandas as gpd
import folium

# Load GeoJSONs
cosub = gpd.read_file("geography/wa_cosub.geojson")
reservations = gpd.read_file("geography/wa_reservations.geojson")

# Initialize map
m = folium.Map(location=[47.5, -120.0], zoom_start=6)

# Add county subdivisions
folium.GeoJson(
    cosub,
    name="County Subdivisions",
    style_function=lambda x: {
        "fillColor": "lightgrey",
        "color": "black",
        "weight": 1,
        "fillOpacity": 0.3
    }
).add_to(m)

# Add reservations
folium.GeoJson(
    reservations,
    name="Reservations",
    style_function=lambda x: {
        "fillColor": "green",
        "color": "black",
        "weight": 1,
        "fillOpacity": 0.4
    }
).add_to(m)

# Layer control
folium.LayerControl().add_to(m)

# Save HTML
m.save("wandering_officers_map.html")
print("Map saved as wandering_officers_map.html")
