use log::debug;

use crate::libs::{noise::Noise, types::Coords3};

use super::{
    chunk::Chunk,
    constants::{PLANT_SCALE, TREE_SCALE},
    registry::Registry,
};

#[derive(Debug)]
pub struct VoxelUpdate {
    pub voxel: Coords3<i32>,
    pub id: u32,
}

#[derive(Debug)]
pub struct Builder {
    noise: Noise,
    registry: Registry,
}

impl Builder {
    pub fn new(registry: Registry, noise: Noise) -> Self {
        Self { noise, registry }
    }

    fn sample_plants(&self, chunk: &Chunk) -> Vec<Coords3<i32>> {
        let mut locations = Vec::new();
        let Chunk { min, max, .. } = chunk;

        for vx in min.0..max.0 {
            for vz in min.2..max.2 {
                let vy = chunk.get_max_height(vx, vz);
                if self.registry.is_plantable(chunk.get_voxel(vx, vy, vz))
                    && self
                        .noise
                        .central_fractal_perlin(vx as f64, vz as f64, PLANT_SCALE, 5)
                {
                    locations.push(Coords3(vx, vy + 1, vz));
                }
            }
        }

        locations
    }

    fn generate_plants(&self, chunk: &Chunk) -> Vec<VoxelUpdate> {
        let locations = self.sample_plants(chunk);
        let types = self.registry.get_type_map(vec![
            "Dirt",
            "Grass",
            "Tan Grass",
            "Brown Grass",
            "Brown Mushroom",
            "Red Mushroom",
            "Tan Mushroom",
        ]);

        let mut updates = Vec::new();

        for location in locations.into_iter() {
            let Coords3(vx, vy, vz) = location;
            let stand = chunk.get_voxel(vx, vy - 1, vz);

            let mut id = types["Grass"];

            let vx = vx as f64;
            let vy = vy as f64;
            let vz = vz as f64;

            if self
                .noise
                .fractal_octave_perlin3(vx, vy, vz, PLANT_SCALE * 2.46, 3)
                > 0.3
            {
                id = types["Red Mushroom"];
            } else if self
                .noise
                .fractal_octave_perlin3(vx, vy, vz, PLANT_SCALE * 10.852, 6)
                > 0.33
                && stand == types["Dirt"]
            {
                id = types["Brown Mushroom"];
            } else if self
                .noise
                .fractal_octave_perlin3(vx, vy, vz, PLANT_SCALE * 9.012, 4)
                > 0.3
            {
                id = types["Tan Grass"];
            } else if self
                .noise
                .fractal_octave_perlin3(vx, vy, vz, PLANT_SCALE * 6.45, 2)
                > 0.36
            {
                id = types["Tan Mushroom"];
            } else if self
                .noise
                .fractal_octave_perlin3(vx, vy, vz, PLANT_SCALE * 4.44, 1)
                > 0.25
                && stand == types["Dirt"]
            {
                id = types["Brown Grass"];
            }

            updates.push(VoxelUpdate {
                id,
                voxel: location,
            });
        }

        updates
    }

    fn sample_trees(&self, chunk: &Chunk) -> Vec<Coords3<i32>> {
        let mut locations = Vec::new();
        let Chunk { min, max, .. } = chunk;

        for vx in min.0..max.0 {
            for vz in min.2..max.2 {
                let vy = chunk.get_max_height(vx, vz);
                if self.registry.is_plantable(chunk.get_voxel(vx, vy, vz))
                    && self.noise.central_perlin(vx as f64, vz as f64, TREE_SCALE)
                {
                    locations.push(Coords3(vx, vy, vz));
                }
            }
        }

        locations
    }

    fn generate_trees(&self, chunk: &Chunk) -> Vec<VoxelUpdate> {
        let locations = self.sample_trees(chunk);
        let types = self
            .registry
            .get_type_map(vec!["Trunk", "Leaves", "Leaves Orange"]);

        let mut updates = Vec::new();

        for location in locations.into_iter() {
            let Coords3(vx, vy, vz) = location;

            let test = TREE_SCALE * 4.124;
            let test2 = TREE_SCALE * 1.424;
            let test3 = TREE_SCALE * 2.41;
            let test4 = TREE_SCALE * 5.3425;

            let vx = vx as f64;
            let vy = vy as f64;
            let vz = vz as f64;

            let height = if self.noise.perlin2(vx, vz, test4) > 0.06 {
                3
            } else {
                2
            };

            let bush_height = if self.noise.perlin2(vx, vz, 0.005) > 0.1 {
                8
            } else if self.noise.perlin2(vx, vz, test2) > 0.1 {
                5
            } else if height == 3 {
                3
            } else {
                2
            };

            let leaves_type = if self.noise.perlin2(vx, vz, 0.005) > 0.1 {
                types["Leaves Orange"]
            } else {
                types["Leaves"]
            };

            for i in 0..height {
                updates.push(VoxelUpdate {
                    voxel: Coords3(vx as i32, vy as i32 + i, vz as i32),
                    id: types["Trunk"],
                })
            }

            let Coords3(tbx, tby, tbz) = Coords3(vx as i32, vy as i32 + height, vz as i32);

            let bush_size = 1;
            let bush_big_size = 2;

            for j in 0..=bush_height {
                let limit: i32 = if j % 3 == 1
                    || j % 3 == (if height == 2 { 0 } else { 2 }) && j != bush_height
                {
                    bush_big_size
                } else {
                    bush_size
                };

                for i in -limit..=limit {
                    for k in -limit..=limit {
                        let center = i == 0 && k == 0;
                        let mf = if center && j != bush_height {
                            types["Trunk"]
                        } else {
                            leaves_type
                        };

                        if i.abs() == limit && k.abs() == limit {
                            continue;
                        }

                        if !center
                            && self.noise.fractal_octave_perlin3(
                                (vx as i32 + i) as f64,
                                (vy as i32 + j) as f64,
                                (vz as i32 + k) as f64,
                                test3,
                                9,
                            ) > 0.4
                        {
                            continue;
                        }

                        updates.push(VoxelUpdate {
                            voxel: Coords3(tbx + i, tby + j, tbz + k),
                            id: mf,
                        });
                    }
                }
            }
        }

        updates
    }

    fn sample_lamps(&self, chunk: &Chunk) -> Vec<Coords3<i32>> {
        let mut locations = Vec::new();
        let Chunk { min, max, .. } = chunk;

        for vx in min.0..max.0 {
            for vz in min.2..max.2 {
                let vy = chunk.get_max_height(vx, vz);
                if self.registry.is_plantable(chunk.get_voxel(vx, vy, vz))
                    && self.noise.central_perlin(vx as f64, vz as f64, 0.02)
                {
                    locations.push(Coords3(vx, vy, vz));
                }
            }
        }

        locations
    }

    fn generate_lamps(&self, chunk: &Chunk) -> Vec<VoxelUpdate> {
        let locations = self.sample_lamps(chunk);
        let types = self.registry.get_type_map(vec!["Stone", "Yellow"]);

        let mut updates = Vec::new();

        for location in locations.into_iter() {
            updates.push(VoxelUpdate {
                voxel: location,
                id: types["Yellow"],
            })
        }

        updates
    }

    pub fn build(&self, chunk: &Chunk) -> Vec<VoxelUpdate> {
        let mut updates = Vec::new();

        updates.append(&mut self.generate_plants(chunk));
        updates.append(&mut self.generate_trees(chunk));
        updates.append(&mut self.generate_lamps(chunk));

        updates
    }
}