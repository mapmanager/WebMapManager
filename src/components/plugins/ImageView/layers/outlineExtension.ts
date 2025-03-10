import {
  Accessor,
  Layer,
  LayerContext,
  LayerExtension,
  UpdateParameters,
} from "@deck.gl/core";

const outlineShaders = {
  inject: {
    "vs:#decl": `
attribute float outlineWidth;
varying float instanceTypesV;
varying float offsetWidth;
`,
    "fs:#decl": `
varying float instanceTypesV;
varying float offsetWidth;
`,
    "vs:DECKGL_FILTER_SIZE": `
offsetWidth = abs(outlineWidth * 2.0 * 1.0) + 1.0;
size *= offsetWidth;
    `,
    "vs:#main-end": `
offsetWidth = outlineWidth / (outlineWidth + instanceStrokeWidths);
instanceTypesV = instanceTypes;
`,
    "fs:#main-start": `
float offsetLength = 1.0 - offsetWidth;
if (vPathPosition.x >= -offsetWidth && vPathPosition.x <= offsetWidth) {
  if ((instanceTypesV == 2.0 || instanceTypesV == 3.0) && vPathPosition.y > vPathLength - offsetLength) {
    // Keep start.
  } else if ((instanceTypesV == 1.0 || instanceTypesV == 3.0) && vPathPosition.y < offsetLength) {
    // Keep end.
  } else {
    // Discard center
    discard;
  }
}
`,
  },
};

const defaultProps = {
  getOutlineWidth: { type: "accessor", value: 0 },
};

export type PathStyleExtensionProps<DataT = any> = {
  /**
   * Accessor for the outline to draw around each path with, relative to the width of the path.
   * @default 0
   */
  getOutlineWidth?: Accessor<DataT, number>;
};

type OutlinePathExtensionOptions = {};

/** Adds selected features to the `PathLayer` and composite layers that render the `PathLayer`. */
export class OutlinePathExtension extends LayerExtension<OutlinePathExtensionOptions> {
  static defaultProps = defaultProps;
  static extensionName = "OutlinePathExtension";

  constructor() {
    super({});
  }

  isEnabled(layer: Layer<PathStyleExtensionProps>): boolean {
    return "pathTesselator" in layer.state;
  }

  getShaders(this: Layer<PathStyleExtensionProps>, extension: this): any {
    if (!extension.isEnabled(this)) {
      return null;
    }

    return outlineShaders;
  }

  initializeState(
    this: Layer<PathStyleExtensionProps>,
    context: LayerContext,
    extension: this
  ) {
    const attributeManager = this.getAttributeManager();
    if (!attributeManager || !extension.isEnabled(this)) {
      // This extension only works with the PathLayer
      return;
    }

    attributeManager.addInstanced({
      outlineWidth: { size: 1, accessor: "getOutlineWidth" },
    });
  }

  updateState(
    this: Layer<PathStyleExtensionProps>,
    params: UpdateParameters<Layer<PathStyleExtensionProps>>,
    extension: this
  ) {
    if (!extension.isEnabled(this)) {
      return;
    }

    // this.state.model.setUniforms({});
  }
}
