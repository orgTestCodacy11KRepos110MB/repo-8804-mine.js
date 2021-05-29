import { Coords2, Helper } from '../../shared';

import { World, Chunk, ClientType } from '.';

class Chunks {
  private chunks: Map<string, Chunk> = new Map();

  constructor(public world: World) {}

  all = () => {
    return Array.from(this.chunks.values());
  };

  data = () => {
    return this.chunks;
  };

  raw = (coords: Coords2) => {
    return this.getChunk(coords);
  };

  get = (coords: Coords2) => {
    const chunk = this.getChunk(coords);

    // TODO: add more conditions here?
    if (!chunk || chunk.neighbors.length !== 8 || chunk.needsTerrain || chunk.needsDecoration) {
      return null;
    }

    return chunk;
  };

  generate = async (client: ClientType) => {
    const { position, renderRadius } = client;
    const { chunkSize, dimension, maxHeight } = this.world.options;

    const [cx, cz] = Helper.mapVoxelPosToChunkPos(Helper.mapWorldPosToVoxelPos(position, dimension), chunkSize);

    const toDecorate: Chunk[] = [];
    const toGenerate: Chunk[] = [];

    const terrainRadius = renderRadius + 2;

    for (let x = -terrainRadius; x <= terrainRadius; x++) {
      for (let z = -terrainRadius; z <= terrainRadius; z++) {
        if (x ** 2 + z ** 2 >= terrainRadius * terrainRadius) continue;

        const coords = [cx + x, cz + z] as Coords2;
        let chunk = this.getChunk(coords);

        // chunk is not yet initialized
        if (!chunk) {
          // make chunk
          chunk = new Chunk(coords, this.world, { dimension, size: chunkSize, maxHeight });
          toGenerate.push(chunk);
          this.addChunk(chunk);
        }

        if (x ** 2 + z ** 2 <= renderRadius * renderRadius) {
          toDecorate.push(chunk);
        }
      }
    }

    // a promise that generates terrains in parallel
    await new Promise((resolve) => {
      let count = 0;
      toGenerate.forEach((chunk) => {
        chunk.generate().then(() => {
          count++;
          if (count === toGenerate.length) {
            resolve(true);
          }
        });
      });
    });

    // at this point, we've made sure that chunks around the
    // player have terrains. time to decorate them
    toDecorate.forEach((chunk) => {
      if (chunk.needsDecoration) {
        chunk.decorate();
      }
    });

    // after decoration, generate height map for future process
    toDecorate.forEach((chunk) => {
      chunk.generateHeightMap();
    });
  };

  private addChunk = (chunk: Chunk) => {
    this.chunks.set(chunk.name, chunk);
  };

  private getChunk = (coords: Coords2) => {
    const name = Helper.getChunkName(coords);
    return this.chunks.get(name);
  };
}

export { Chunks };
