use crate::libs::types::{Block, UV};
use crate::utils::json;

use std::collections::HashMap;

type Ranges = HashMap<String, UV>;
type Blocks = HashMap<String, Block>;

pub struct Registry {
    pub atlas: image::RgbaImage,
    pub ranges: Ranges,
    pub blocks: Blocks,

    name_map: HashMap<String, u32>,
}

impl Registry {
    pub fn new() -> Self {
        let blocks_json = json::read_json_file("metadata/blocks.json").unwrap();

        let mut base_cache: HashMap<String, serde_json::Value> = HashMap::new();
        let mut texture_map: HashMap<String, image::DynamicImage> = HashMap::new();

        let mut name_map = HashMap::new();

        let mut blocks: Blocks = HashMap::new();

        for (id, value) in blocks_json.as_object().unwrap() {
            // remove first and last characters to remove the ""
            let value_str = value.as_str().unwrap();
            let path = format!("./metadata/blocks/{}", value_str);
            let mut block_json = json::read_json_file(&path).unwrap();

            let base = &block_json["base"];

            let base = match base {
                serde_json::Value::String(base_str) => Some(
                    base_cache.entry(base_str.to_owned()).or_insert(
                        json::read_json_file(format!("./metadata/blocks/{}", base_str).as_str())
                            .unwrap(),
                    ),
                ),
                _ => None,
            }
            .unwrap();

            json::merge(&mut block_json, base);

            let textures = &block_json["textures"];
            let mut textures_hash = HashMap::new();

            if !serde_json::Value::is_null(textures) {
                for (side, img_src) in textures.as_object().unwrap().iter() {
                    let img_src_str = img_src.as_str().unwrap();

                    let image = if img_src_str.ends_with(".png") {
                        image::open(&format!("textures/images/{}", img_src_str)).unwrap()
                    } else {
                        // texture data
                        let texture_data =
                            json::read_json_file(&format!("textures/procedural/{}", img_src_str))
                                .unwrap();
                        let color_vec = texture_data["color"].as_array().unwrap().as_slice();

                        let color_r = (color_vec[0].as_f64().unwrap() * 255.0) as u8;
                        let color_g = (color_vec[1].as_f64().unwrap() * 255.0) as u8;
                        let color_b = (color_vec[2].as_f64().unwrap() * 255.0) as u8;

                        let imgbuf = image::ImageBuffer::from_pixel(
                            16,
                            16,
                            image::Rgb([color_r, color_g, color_b]),
                        );

                        image::DynamicImage::ImageRgb8(imgbuf)
                    };

                    texture_map.insert(img_src_str.to_owned(), image);
                    textures_hash.insert(side.to_owned(), img_src_str.to_owned());
                }

                let new_block = Block {
                    name: block_json["name"].as_str().unwrap().to_owned(),
                    is_block: block_json["isBlock"].as_bool().unwrap(),
                    is_empty: block_json["isEmpty"].as_bool().unwrap(),
                    is_fluid: block_json["isFluid"].as_bool().unwrap(),
                    is_light: block_json["isLight"].as_bool().unwrap(),
                    is_plant: block_json["isPlant"].as_bool().unwrap(),
                    is_solid: block_json["isSolid"].as_bool().unwrap(),
                    is_transparent: block_json["isTransparent"].as_bool().unwrap(),
                    light_level: block_json["lightLevel"].as_i64().unwrap(),
                    textures: textures_hash,
                    transparent_standalone: block_json["transparentStandalone"].as_bool().unwrap(),
                };

                name_map.insert(new_block.name.clone(), id.parse::<u32>().unwrap() as u32);

                blocks.insert(id.to_owned(), new_block);
            }
        }

        // OBTAINED TEXTURE MAP
        let map_size = texture_map.len() as f32;
        let count_per_side = ((map_size.sqrt() / 2.0).ceil().round() * 2.0).ceil() as u32;
        let texture_dim = 64;
        let atlas_width = count_per_side * texture_dim;
        let atlas_height = count_per_side * texture_dim;

        let mut atlas: image::RgbaImage = image::ImageBuffer::new(atlas_width, atlas_height);

        let mut ranges = HashMap::new();

        let mut row = 0;
        let mut col = 0;

        for (key, image) in texture_map {
            if col >= count_per_side {
                col = 0;
                row = row + 1;
            }

            let start_x = col * texture_dim;
            let start_y = row * texture_dim;

            let resized = image::imageops::resize(
                &image,
                texture_dim,
                texture_dim,
                image::imageops::FilterType::CatmullRom,
            );

            image::imageops::overlay(&mut atlas, &resized, start_x, start_y);

            let f_start_x = start_x as f32;
            let f_start_y = start_y as f32;

            let f_atlas_width = atlas_width as f32;
            let f_atlas_height = atlas_height as f32;

            let start_u = f_start_x / f_atlas_width;
            let end_u = (f_start_x + texture_dim as f32) / f_atlas_width;
            let start_v = f_start_y / f_atlas_height;
            let end_v = (f_start_y + texture_dim as f32) / f_atlas_height;

            ranges.insert(
                key,
                UV {
                    start_u,
                    end_u,
                    start_v,
                    end_v,
                },
            );

            col = col + 1;
        }

        atlas.save("textures/atlas.png").unwrap();

        Self {
            atlas,
            ranges,
            blocks,
            name_map,
        }
    }

    pub fn get_block_by_id(&self, id: u32) -> Option<&Block> {
        let id_key = id.to_string();
        self.blocks.get(&id_key)
    }

    pub fn get_block_by_name(&self, name: String) -> Option<&Block> {
        let id = self.name_map.get(&name);

        match id {
            Some(&id) => self.get_block_by_id(id),
            None => None,
        }
    }
}