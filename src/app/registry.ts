import { Engine } from '..';

import { Color, MeshStandardMaterial, Texture } from 'three';
import { SmartDictionary } from '../libs';

type MaterialOptions = {
  color?: string;
  map?: Texture;
};

type BlockType = {
  name: string;
  material: MeshStandardMaterial;
};

class Registry {
  public engine: Engine;

  public materials: SmartDictionary<MeshStandardMaterial>;
  public blocks: SmartDictionary<BlockType>;

  constructor(engine: Engine) {
    this.engine = engine;

    this.materials = new SmartDictionary<MeshStandardMaterial>();
    this.blocks = new SmartDictionary<BlockType>();

    this.addMaterial('dirt', { color: '#edc9af' });
    this.addMaterial('grass', { color: '#41980a' });
    this.addMaterial('stone', { color: '#999C9B' });
  }

  addMaterial(name: string, options: MaterialOptions) {
    const { color, map } = options;

    if (!color && !map) {
      throw new Error(`Error adding material, ${name}: no color or map provided.`);
    }

    if (this.materials.getIndex(name) >= 0) {
      throw new Error(`Error adding material, ${name}: material name taken.`);
    }

    const material = new MeshStandardMaterial(options);
    this.materials.set(name, material);

    return material;
  }

  registerBlock(name: string, type: string) {
    const material = this.getMaterial(type);

    if (!material) {
      throw new Error(`Error registering block, ${name}: material not found.`);
    }

    if (this.blocks.getIndex(name) >= 0) {
      throw new Error(`Error registering block, ${name}: block name taken.`);
    }

    const newBlock = {
      name,
      material,
    };
    this.blocks.set(name, newBlock);

    return newBlock;
  }

  getMaterialIndex(name: string) {
    return this.materials.getIndex(name);
  }

  getMaterial(name: string) {
    return this.materials.get(name);
  }

  getBlockIndex(name: string) {
    return this.blocks.getIndex(name);
  }

  getBlock(name: string) {
    return this.blocks.get(name);
  }
}

export { Registry };