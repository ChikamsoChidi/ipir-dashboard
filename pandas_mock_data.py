import math
import random
import pandas as pd

class PipeGenerator:
    def __init__(self, nominal_radius=35.0):
        self.nominal_radius = nominal_radius
        self.data = {
            "frame_id": [],
            "axial_distance_ft": [],
            "segment_type": [],  # Added new orientation tracking column
            "frame_roll_rad": [],
            "frame_tilt_rad": [],
            "frame_yaw_rad": [],
            "center_x_mm": [],
            "center_y_mm": [],
            "center_z_mm": [],
            "radius_mm": [],
            "x_mm": [],
            "y_mm": []
        }
        self.current_frame_id = 0
        self.current_axial_dist = 0.0
        self.current_tilt = 0.0
        self.current_yaw = 0.0
        self.current_x_mm = 0.0
        self.current_y_mm = 0.0
        self.current_z_mm = 0.0
        self.FT_TO_MM = 304.8

    def _advance_position(self, step_ft): 
        step_mm = step_ft * self.FT_TO_MM
        # Calculate next 3D step based on current orientation angles
        dx = step_mm * math.cos(self.current_tilt) * math.sin(self.current_yaw)
        dy = step_mm * math.sin(self.current_tilt)
        dz = step_mm * math.cos(self.current_tilt) * math.cos(self.current_yaw)

        self.current_x_mm += dx
        self.current_y_mm += dy
        self.current_z_mm += dz
        self.current_axial_dist += step_ft

    def _generate_frame(self, segment_type):
        roll = round(random.uniform(-0.005, 0.005), 5)
        cx = round(self.current_x_mm, 2)
        cy = round(self.current_y_mm, 2)
        cz = round(self.current_z_mm, 2)

        for angle_deg in range(360):
            angle_rad = math.radians(angle_deg)
            radius = self.nominal_radius + random.uniform(-0.1, 0.1)

            # Inject dashboard anomalies into specific frame index ranges
            f_id = self.current_frame_id
            if 10 <= f_id <= 22:   # WL-001: External Corrosion
                if 45 <= angle_deg <= 135: radius += random.uniform(5.2, 5.6)
            elif 28 <= f_id <= 42: # DB-001: Sedimentation Deposit
                if 225 <= angle_deg <= 315: radius -= random.uniform(6.8, 7.2)
            elif 52 <= f_id <= 65: # WL-002: Severe Pitting
                if 0 <= angle_deg <= 60: radius += random.uniform(7.8, 8.3)
            elif 71 <= f_id <= 73: # WLD-001: Weld Anomaly
                radius += random.uniform(1.8, 2.1)

            radius = round(radius, 2)
            x_mm = round(radius * math.cos(angle_rad), 2)
            y_mm = round(radius * math.sin(angle_rad), 2)

            self.data["frame_id"].append(f_id)
            self.data["axial_distance_ft"].append(round(self.current_axial_dist, 3))
            self.data["segment_type"].append(segment_type)
            self.data["frame_roll_rad"].append(roll)
            self.data["frame_tilt_rad"].append(round(self.current_tilt, 5))
            self.data["frame_yaw_rad"].append(round(self.current_yaw, 5))
            self.data["center_x_mm"].append(cx)
            self.data["center_y_mm"].append(cy)
            self.data["center_z_mm"].append(cz)
            self.data["radius_mm"].append(radius)
            self.data["x_mm"].append(x_mm)
            self.data["y_mm"].append(y_mm)

    def add_straight(self, num_frames, step_ft=3.0):
        for _ in range(num_frames):
            self._generate_frame(segment_type="straight")
            self.current_frame_id += 1
            self._advance_position(step_ft)

    def add_bend(self, num_frames, direction, degrees=90, step_ft=3.0):
        rad_per_frame = math.radians(degrees) / num_frames
        for _ in range(num_frames):
            if direction == "up":    self.current_tilt += rad_per_frame
            elif direction == "down":  self.current_tilt -= rad_per_frame
            elif direction == "left":  self.current_yaw += rad_per_frame
            elif direction == "right": self.current_yaw -= rad_per_frame

            self._generate_frame(segment_type=f"bend_{direction}")
            self.current_frame_id += 1
            self._advance_position(step_ft)

    def save_to_csv(self, filename="pipedata.csv"):
        df = pd.DataFrame(self.data)
        df.to_csv(filename, index=False)
        print(f"Generated {self.current_frame_id} frames. Distance: {self.current_axial_dist:.1f}ft. Saved to {filename}")

if __name__ == "__main__":
    pipe = PipeGenerator()
    pipe.add_straight(15)       # Frames 0-14 (Contains Anomaly 1)
    pipe.add_bend(15, "left")   # Frames 15-29 (Contains Anomaly 2)
    pipe.add_straight(20)       # Frames 30-49 (Contains Anomaly 3)
    pipe.add_bend(15, "up")     # Frames 50-64 (Contains Anomaly 4)
    pipe.add_straight(25)       # Frames 65-89
    pipe.save_to_csv("pipedata.csv")