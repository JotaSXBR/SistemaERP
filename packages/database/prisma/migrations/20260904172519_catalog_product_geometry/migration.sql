-- AlterTable
ALTER TABLE "products" ADD COLUMN     "height_mm" DECIMAL(24,10),
ADD COLUMN     "inner_diameter_mm" DECIMAL(24,10),
ADD COLUMN     "length_mm" DECIMAL(24,10),
ADD COLUMN     "outer_diameter_mm" DECIMAL(24,10),
ADD COLUMN     "thickness_mm" DECIMAL(24,10),
ADD COLUMN     "weight_per_meter_kg" DECIMAL(24,10),
ADD COLUMN     "weight_per_square_meter_kg" DECIMAL(24,10),
ADD COLUMN     "width_mm" DECIMAL(24,10);
