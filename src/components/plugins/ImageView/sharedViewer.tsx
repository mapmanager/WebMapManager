import { Color, OrthographicView } from "@deck.gl/core";
import {
  ColorPaletteExtension,
  OVERVIEW_VIEW_ID,
  OverviewView,
  SideBySideView,
  VivViewer,
  getDefaultInitialViewState,
} from "@hms-dbmi/viv";
import { useEffect, useMemo } from "react";
import { ViewSelection } from "../../../loaders/annotations";
import { signal, useComputed, useSignal } from "@preact/signals-react";
import { PyPixelSourceTimePoint } from "../../../loaders/py_loader";

const MAX_ZOOM = 4;
const MIN_ZOOM = -2;
const DEFAULT_CONTROLLER = {
  keyboard: false,
  doubleClickZoom: false,
};

interface ImageViewsState {
  [id: string]: ImageViewerProps & {
    layers: any[];
    zoom?: number;
    version?: number;
  };
}

const ViewsContext = signal<ImageViewsState>({});

interface ImageViewerProps {
  id: string;
  x: number;
  y: number;
  minimap: boolean;
  width: number;
  height: number;
  channelsVisible: boolean[];
  colors: Color[];
  contrastLimits: [number, number][];
  selections: ViewSelection[];
  linked: boolean;
  loader: PyPixelSourceTimePoint;
  layers: any[];
  target?: [number, number];
}

let counter = 0;
export const ImageViewer = ({
  children,
  ...props
}: ImageViewerProps & { children: any }) => {
  useEffect(() => {
    if (props.width <= 0 || props.height <= 0) return;

    ViewsContext.value = {
      ...ViewsContext.value,
      [props.id]: {
        ...props,
        version: counter++,
      },
    };

    return () => {
      let views = ViewsContext.peek();
      if (!views[props.id]) return;
      views = { ...views };
      delete views[props.id];
      ViewsContext.value = views;
    };
  }, [props]);

  return <div className="ImageView">{children}</div>;
};

const DEFAULT_OVERVIEW = {
  minimumWidth: 0,
  minimumHeight: 0,
  maximumWidth: 150,
  maximumHeight: 150,
  margin: 8,
  scale: 0.2,
  position: "top-left",
  clickCenter: true,
};

const extensions = [new ColorPaletteExtension()];

// getTooltip is forwarded to any layer, allowing the layer to override it
const getTooltip = ({ object, layer }: any) => {
  if (!layer || !layer.props.getTooltip || !object) return;
  return layer.props.getTooltip(object);
};

export const setImageViewPort = (
  imageId: string,
  zoom: number = MIN_ZOOM,
  target?: [number, number]
) => {
  const viewStates = ViewsContext.peek();
  if (!viewStates[imageId]) return;

  const viewState = viewStates[imageId] as any;
  if (!target) {
    const defaultViewState = getDefaultInitialViewState(
      [viewState.loader],
      { height: viewState.height, width: viewState.width },
      zoom
    ) as any;

    target = [...defaultViewState.target] as any;
    zoom = defaultViewState.zoom;
  }

  let oldZoom = viewState.zoom;
  if (oldZoom == zoom) {
    // Force the viewer to reload even if the zoom is the same
    zoom += 0.00000000000001;
  }

  const newViewState = {
    ...viewState,
    target,
    zoom: Math.max(Math.min(zoom, MAX_ZOOM), MIN_ZOOM),
    version: counter++,
  };

  const update = { ...viewStates } as any;
  update[imageId] = newViewState;

  if (viewState.minimap) {
    const miniId = OVERVIEW_VIEW_ID + "-" + imageId;
    update[miniId] = {
      ...update[miniId],
      target,
      zoom: Math.max(Math.min(zoom, MAX_ZOOM), MIN_ZOOM),
      version: counter++,
    };
  }

  ViewsContext.value = update;
};

export const ImageViewerRoot = ({ children }: { children: any[] }) => {
  const viewStates = useSignal<any>({});
  const viewsProps = ViewsContext.value;

  const [views, layerProps, layers] = useMemo(() => {
    const viewsProps_ = Object.values(viewsProps);

    const linkedIds = viewsProps_
      .filter(({ linked }) => linked)
      .map(({ id }) => id);

    const views = viewsProps_.map(
      ({ id, height, width, x, y, linked }) =>
        new SideBySideViewController({
          id,
          linkedIds: linked ? linkedIds : [],
          panLock: linked,
          zoomLock: linked,
          height,
          width,
          x,
          y,
          viewportOutlineWidth: 0,
        })
    );

    const layerProps = viewsProps_.map(
      ({
        id,
        contrastLimits,
        colors,
        channelsVisible,
        selections,
        loader,
      }) => ({
        id,
        loader: [loader],
        contrastLimits,
        colors,
        channelsVisible,
        selections,
        extensions,
      })
    );

    const layers = viewsProps_.map(({ layers }) => layers).flat();

    // Add mini maps
    for (const idx in viewsProps_) {
      const view = viewsProps_[idx];
      if (!view.minimap) continue;
      const id = OVERVIEW_VIEW_ID + "-" + view.id;
      const overviewView = new OverviewViewWithOffset(
        {
          id,
          loader: [view.loader],
          detailHeight: view.height,
          detailWidth: view.width,
          ...DEFAULT_OVERVIEW,
        },
        view.x,
        view.y
      );
      views.push(overviewView as any);
      layerProps.push({
        ...layerProps[idx],
        lensEnabled: false,
        id,
        detail: view.id,
      } as any);
    }

    const viewState = viewStates.peek();
    const newStates = {} as any;

    const linkedZViewState = viewsProps_.find(({ id, linked, zoom }) => linked && (zoom !== undefined || viewState[id]?.zoom !== undefined));
    let linkedZ = linkedZViewState ? linkedZViewState?.zoom ?? viewState[linkedZViewState.id]?.zoom : undefined;

    for (const value of viewsProps_ as any) {
      let {
        id,
        height,
        width,
        minimap,
        target,
        zoom,
        loader,
        version,
        linked
      } = value;
      if (linked && linkedZ !== undefined) {
        zoom = linkedZ;
      }

      if (!Object.hasOwn(viewState, id)) {
        const defaultViewState = getDefaultInitialViewState(
          [loader],
          { height, width },
          0.5
        ) as any;

        if (linked && zoom === undefined && linkedZ === undefined) {
          linkedZ = defaultViewState.zoom;
        }

        newStates[id] = {
          ...defaultViewState,
          zoom: zoom ?? defaultViewState.zoom,
          target: target ?? defaultViewState.target,
          version,
          id,
        };
      } else if (version !== viewState[id].version) {
        newStates[id] = {
          ...viewState[id],
          target: target ?? viewState[id].target,
          zoom: zoom ?? viewState[id].zoom,
          version,
          id,
        };
      }

      if (!minimap) continue;
      const miniId = OVERVIEW_VIEW_ID + "-" + id;
      if (Object.hasOwn(viewState, miniId) && !Object.hasOwn(newStates, id))
        continue;

      newStates[miniId] = {
        ...(newStates[id] || viewState[id]),
        id: miniId,
      };
    }

    if (Object.keys(newStates).length) {
      // Merge old values into the new state
      for (const id of Object.keys(viewState)) {
        if (!Object.hasOwn(newStates, id) && Object.hasOwn(viewState, id)) {
          newStates[id] = viewState[id];
        }
      }
      viewStates.value = newStates;
    }

    return [views, layerProps, layers];
  }, [viewsProps, viewStates]);

  const viewStatesArr = useComputed(() => [
    ...Object.entries(viewStates.value).map(([id, viewState]: any) => {
      viewState.id = id;
      return viewState;
    }),
  ]) as any;

  return (
    <>
      <VivViewer
        layerProps={layerProps}
        views={views}
        viewStates={viewStatesArr.value}
        deckProps={{
          layers,
          getTooltip,
        }}
        onViewStateChange={(args: any) => {
          const { viewState, viewId, oldViewState } = args;
          const state = viewStates.peek();

          // Restrict zoom
          if (viewState.zoom > MAX_ZOOM || viewState.zoom < MIN_ZOOM) {
            viewState.zoom = Math.max(
              Math.min(viewState.zoom, MAX_ZOOM),
              MIN_ZOOM
            );
            viewState.target = oldViewState.target ?? [];
          }

          state[viewId] = viewState;

          // Propagate changes from the overview
          if (viewId.startsWith(OVERVIEW_VIEW_ID)) {
            const id = viewId.slice(OVERVIEW_VIEW_ID.length + 1);
            state[id] = { ...state[id], target: viewState.target, id };
            viewStates.value = { ...state };
          }
        }}
      />
      {children}
    </>
  );
};

class OverviewViewWithOffset extends OverviewView {
  constructor(options: any, xOffset: number, yOffset: number) {
    super(options);
    this.x += xOffset;
    this.y += yOffset;
  }

  getLayers({ viewStates, props }: { viewStates: any; props: any }): any[] {
    return super.getLayers({
      viewStates: {
        detail: viewStates[props.detail],
        overview: viewStates[props.id],
      },
      props,
    });
  }
}

class SideBySideViewController extends SideBySideView {
  getDeckGlView() {
    // override the orthographic view to override the controller
    return new OrthographicView({
      controller: DEFAULT_CONTROLLER,
      id: this.id,
      height: this.height,
      width: this.width,
      x: this.x,
      y: this.y,
    });
  }
}
