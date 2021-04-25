import { CanvasTexture, ShaderMaterial, Color, ClampToEdgeWrapping, NearestFilter } from 'three';

import { Engine } from './engine';
import ChunkFragmentShader from './shaders/chunk/fragment.glsl';
import ChunkVertexShader from './shaders/chunk/vertex.glsl';

type RegistryOptionsType = {
  textureWidth: number;
};

class Registry {
  public chunkMaterial: ShaderMaterial;

  constructor(public engine: Engine, public options: RegistryOptionsType) {
    const { chunkSize, dimension, renderRadius } = this.engine.config.world;

    const uTexture = { value: undefined };

    this.chunkMaterial = new ShaderMaterial({
      // wireframe: true,
      fog: true,
      transparent: true,
      vertexShader: ChunkVertexShader,
      fragmentShader: ChunkFragmentShader,
      vertexColors: true,
      uniforms: {
        uTexture,
        uFogColor: { value: new Color(this.engine.config.rendering.fogColor) },
        uFogNear: { value: renderRadius * 0.5 * chunkSize * dimension },
        uFogFar: { value: renderRadius * chunkSize * dimension },
        // uFogNear: { value: 100 },
        // uFogFar: { value: 5000 },
      },
    });

    fetch(
      `http://${window.location.hostname}${
        window.location.hostname === 'localhost' ? ':4000' : window.location.port ? `:${window.location.port}` : ''
      }/atlas`,
    )
      .then((response) => {
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.src = url;
        image.onload = () => {
          const texture = new CanvasTexture(image);
          texture.wrapS = ClampToEdgeWrapping;
          texture.wrapT = ClampToEdgeWrapping;
          texture.minFilter = NearestFilter;
          texture.magFilter = NearestFilter;
          texture.generateMipmaps = false;
          texture.needsUpdate = true;
          uTexture.value = texture;
        };
      });
  }
}

export { Registry, RegistryOptionsType };
