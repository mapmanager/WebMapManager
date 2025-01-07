import {
  Button,
  Form,
  InputNumber,
  InputPicker,
  Loader as LoadingInd,
  Nav,
  Panel,
  PanelGroup,
} from "rsuite";
import { PluginProps } from ".";
import { DATA_VERSION, dataChanged } from "./globals";
import { Tree, IconButton } from "rsuite";
import { useEffect, useMemo, useState } from "react";
import TrashIcon from "@rsuite/icons/Trash";
import { Inspector, NavBar } from "../layout";
import { MdOutlineMoreTime } from "react-icons/md";
import { TREE_NODE_DROP_POSITION } from "rsuite/esm/internals/constants";
import { DataTreeNode, Position, PyPixelSource } from "../../loaders/py_loader";
import FileUploadIcon from "@rsuite/icons/FileUpload";
import { useSignal } from "@preact/signals-react";

const unitTypes = [
  "m",
  "dm",
  "cm",
  "mm",
  "µm",
  "nm",
  "pm",
  "fm",
  "am",
  "zm",
  "ym",
].map((item) => ({
  label: item,
  value: item,
}));

const enum NodeType {
  TimePoint = "time",
  Channel = "channel",
  PlaceHolder = "placeholder",
}

interface Node {
  value: string;
  data:
    | {
        type: NodeType.TimePoint;
        timePoint: number;
        name: string;
      }
    | {
        type: NodeType.Channel;
        timePoint: number;
        channel: number;
        slices: number;
        width: number;
        height: number;
        name: string;
      }
    | {
        type: NodeType.PlaceHolder;
        timePoint: number;
        channel: number;
      };
  children?: Node[];
}

const TreeNode = ({
  node,
  loader,
  onDrop,
}: {
  node: Node;
  loader: PluginProps["loader"];
  onDrop: (event: React.DragEvent, timePoint: number, channel: number) => void;
}) => {
  if (node.data.type === NodeType.TimePoint) {
    return (
      <div>
        <div className="flex items-center w-full font-extrabold text-lg">
          <div className="flex flex-col gap-1 w-full">
            <div className="font-bold text-base">{node.data.name}</div>
            <div className="text-sm">Time Point {node.data.timePoint + 1}</div>
          </div>
          <div className="pl-2 text-sm text-gray-400">
            (
            {node.children?.reduce(
              (c, child) => (child.data.type === NodeType.Channel ? c + 1 : c),
              0
            ) ?? 0}
            )
          </div>
          <div className="ml-auto" />
        </div>
      </div>
    );
  }

  if (node.data.type === NodeType.PlaceHolder) {
    return (
      <div className="flex flex-row gap-4 items-center bg-red-950 rounded pr-3">
        <div className="w-[50px] h-[50px] flex-shrink-0 flex flex-col justify-center align-middle">
          <div className="text-white text-center text-xs font-extrabold">
            t{node.data.timePoint + 1}c{node.data.channel + 1}
          </div>
        </div>
        <div className="flex flex-col gap-1 w-full">
          <div className="font-bold text-base">Missing Channel</div>
          <div className="text-sm">Channel {node.data.channel + 1}</div>
        </div>
        <IconButton
          className="shrink-0"
          icon={<FileUploadIcon />}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".mmap,.tif";
            input.multiple = false;
            input.onchange = (event) => {
              event.preventDefault();
              event.stopPropagation();
              const target = event.target as HTMLInputElement;
              if (target.files) {
                onDrop(
                  {
                    dataTransfer: { files: target.files },
                  } as any,
                  (node.data as any).timePoint,
                  (node.data as any).channel
                );
              }
            };
            input.click();
          }}
        >
          Open file
        </IconButton>
      </div>
    );
  }

  return (
    <div className="flex flex-row gap-4 items-center">
      <div className="w-[50px] h-[50px] flex-shrink-0 bg-black flex flex-col justify-center align-middle">
        <div className="text-white text-center text-xs font-extrabold">
          t{node.data.timePoint + 1}c{node.data.channel + 1}
        </div>
      </div>
      <div className="flex flex-col gap-1 w-full">
        <div className="font-bold text-base">{node.data.name}</div>
        <div className="text-sm">Channel {node.data.channel + 1}</div>
      </div>
      <div className="pl-2 text-xs text-gray-400 flex-shrink-0">
        Slices: {node.data.slices}
        <br />({node.data.width}x{node.data.width})
      </div>
      <div className="ml-auto" />
    </div>
  );
};

export const Loader = ({
  loader,
  height,
  visible: visibleSignal,
}: PluginProps) => {
  const [loading, setLoading] = useState(false);
  const selectedSignal = useSignal(undefined as Node | undefined);
  const dataVersion = DATA_VERSION.value;

  const [channels, treeData] = useMemo(() => {
    const channels = loader.maxChannels();
    const treeData = injectPlaceholders(loader.dataTree(), channels);

    for (const timePoint of treeData) {
      for (const channel of timePoint.children ?? []) {
        if (selectedSignal.value?.value === channel.value) {
          return [channels, treeData];
        }
      }
    }

    selectedSignal.value = undefined;

    return [channels, treeData];
  }, [dataVersion, loader]);

  const selected = selectedSignal.value;
  const onDrop = async (
    event: React.DragEvent,
    timePoint: number,
    channel: number,
    dropNodePosition: Position = 0
  ) => {
    const droppedFiles = event.dataTransfer?.files;
    if (!droppedFiles) return;

    setLoading(true);

    for (const file of droppedFiles) {
      if (file.name.endsWith(".tif")) {
        await loader.merge(file, timePoint, channel, dropNodePosition);
        continue;
      }
      alert("Invalid file type. Please upload a '.tif' file.");
      setLoading(false);
      return;
    }
    setLoading(false);
    dataChanged();
  };

  const [value, setValue] = useState({});

  useEffect(() => {
    const value = {
      name: (selected?.data as any)?.name ?? "Unnamed",
      channel:
        (selected?.data?.type === NodeType.Channel
          ? selected?.data?.channel
          : 0) + 1,
      timePoint: ((selected?.data as any)?.timePoint ?? 0) + 1,
    } as Record<string, any>;

    if (selected?.data.type === NodeType.TimePoint) {
      const metadata = loader.metadata(selected?.data.timePoint);

      const voxel = metadata["voxel"];
      value["voxelX"] = voxel["x"];
      value["voxelY"] = voxel["y"];
      value["voxelZ"] = voxel["z"];

      const physicalSize = metadata["physicalSize"];
      value["physicalSizeX"] = physicalSize["x"];
      value["physicalSizeY"] = physicalSize["y"];
      value["physicalSizeUnit"] = physicalSize["unit"];
    }

    setValue(value);
  }, [selected]);

  return (
    <>
      <NavBar>
        {() => {
          return (
            <>
              <Nav>
                <Nav.Item
                  icon={<FileUploadIcon />}
                  onClick={() => {
                    setLoading(true);
                    PyPixelSource.Load()
                      .catch((error) => {
                        error && alert("Failed to load file");
                      })
                      .finally(() => setLoading(false));
                  }}
                >
                  Open
                </Nav.Item>
                <Nav.Item
                  icon={<MdOutlineMoreTime />}
                  onClick={() => {
                    if (loader.createTimePoint()) dataChanged();
                  }}
                >
                  Create Time Point
                </Nav.Item>
              </Nav>
            </>
          );
        }}
      </NavBar>

      <Inspector>
        {() => {
          return (
            <PanelGroup className="h-full flex flex-col">
              <Panel header="Project" defaultExpanded>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <label>Channels</label>
                  <div style={{ paddingLeft: 15, flexGrow: 1 }}>
                    <InputNumber
                      defaultValue={2}
                      min={1}
                      step={1}
                      max={5}
                      value={channels}
                      onChange={(channels) => {
                        if (loader.setMaxChannels(Number(channels)))
                          dataChanged();
                      }}
                    />
                  </div>
                </div>
              </Panel>

              {selected?.data.type === NodeType.Channel ? (
                <>
                  <Form
                    fluid
                    formValue={value}
                    onChange={(v) => setValue({ ...v } as any)}
                    onSubmit={(v) => {
                      if (!v) return;
                      const result = loader.updateChannel(
                        selected?.data.timePoint,
                        (selected?.data as any).channel,
                        v
                      );
                      if (result) dataChanged();
                    }}
                    className="flex flex-col overflow-hidden flex-grow"
                  >
                    <div className="flex-grow overflow-y-scroll">
                      <Panel header="Channel" defaultExpanded>
                        <div className="p-8 flex-shrink-0 w-full">
                          <div className="w-full aspect-square bg-black flex flex-col justify-center align-middle">
                            <div className="text-white text-center text-xl font-extrabold">
                              t{selected?.data.timePoint + 1}c
                              {selected?.data.channel + 1}
                            </div>
                          </div>
                        </div>
                        <Form.Group controlId="name">
                          <Form.ControlLabel>Name</Form.ControlLabel>
                          <Form.Control name="name" />

                          <Form.HelpText>
                            The name of the imported image set
                          </Form.HelpText>
                        </Form.Group>
                        <Form.Group controlId="channel">
                          <Form.ControlLabel>Channel</Form.ControlLabel>
                          <Form.Control
                            name="channel"
                            type="number"
                            min={1}
                            accepter={InputNumber}
                            max={channels}
                            formatter={formatInt}
                          />
                        </Form.Group>
                        <Form.Group controlId="timePoint">
                          <Form.ControlLabel>Time Point</Form.ControlLabel>
                          <Form.Control
                            name="timePoint"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                        </Form.Group>
                      </Panel>
                      <Panel header="Delete Channel" defaultExpanded>
                        <IconButton
                          color="red"
                          appearance="primary"
                          icon={<TrashIcon />}
                          onClick={() => {
                            if (
                              loader.deleteChannel(
                                selected.data.timePoint,
                                (selected.data as any).channel
                              )
                            ) {
                              dataChanged();
                            }
                          }}
                          block
                        >
                          Delete Channel
                        </IconButton>
                      </Panel>
                    </div>

                    <Form.Group
                      controlId="submitButton"
                      className="flex p-5 flex-col items-center border-t border-gray-700"
                    >
                      <Button appearance="primary" type="submit">
                        Save
                      </Button>
                    </Form.Group>
                  </Form>
                </>
              ) : null}
              {selected?.data.type === NodeType.TimePoint ? (
                <>
                  <Form
                    fluid
                    formValue={value}
                    onChange={(v) => setValue({ ...v } as any)}
                    onSubmit={(v) => {
                      if (!v) return;
                      const result = loader.updateTimePoint(
                        selected?.data.timePoint,
                        v
                      );
                      if (result) dataChanged();
                    }}
                    className="flex flex-col overflow-hidden flex-grow"
                  >
                    <div className="flex-grow overflow-y-scroll">
                      <Panel header="Time Point" defaultExpanded>
                        <Form.Group controlId="name">
                          <Form.ControlLabel>Name</Form.ControlLabel>
                          <Form.Control name="name" />
                        </Form.Group>
                        <Form.Group controlId="timePoint">
                          <Form.ControlLabel>Time Point</Form.ControlLabel>
                          <Form.Control
                            name="timePoint"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                        </Form.Group>
                      </Panel>
                      <Panel header="Physical Size" defaultExpanded>
                        <Form.Group controlId="physical-size">
                          <Form.ControlLabel>Unit</Form.ControlLabel>
                          <Form.Control
                            name="physicalSizeUnit"
                            accepter={InputPicker}
                            data={unitTypes}
                          />
                          <Form.ControlLabel>X</Form.ControlLabel>
                          <Form.Control
                            name="physicalSizeX"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                          <Form.ControlLabel>Y</Form.ControlLabel>
                          <Form.Control
                            name="physicalSizeY"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                        </Form.Group>
                      </Panel>
                      <Panel header="Voxels" defaultExpanded>
                        <Form.Group controlId="voxels">
                          <Form.ControlLabel>X</Form.ControlLabel>
                          <Form.Control
                            name="voxelX"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                          <Form.ControlLabel>Y</Form.ControlLabel>
                          <Form.Control
                            name="voxelY"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                          <Form.ControlLabel>Z</Form.ControlLabel>
                          <Form.Control
                            name="voxelZ"
                            type="number"
                            accepter={InputNumber}
                            min={1}
                            formatter={formatInt}
                          />
                        </Form.Group>
                      </Panel>

                      <Panel header="Delete Time Point" defaultExpanded>
                        <IconButton
                          color="red"
                          appearance="primary"
                          className="shrink-0"
                          icon={<TrashIcon />}
                          block
                          onClick={() => {
                            if (
                              loader.deleteTimePoint(selected.data.timePoint)
                            ) {
                              dataChanged();
                            }
                          }}
                        >
                          Delete Time Point
                        </IconButton>
                      </Panel>
                    </div>

                    <Form.Group
                      controlId="submitButton"
                      className="flex p-5 flex-col items-center border-t border-gray-700"
                    >
                      <Button appearance="primary" type="submit" block>
                        Save
                      </Button>
                    </Form.Group>
                  </Form>
                </>
              ) : null}
            </PanelGroup>
          );
        }}
      </Inspector>
      <div style={{ background: "#1a1a1a" }} className="relative h-full w-full">
        <div
          className="pr-4pl-3 h-full"
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDrop(e, treeData.length, 0);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <Tree
            data={treeData}
            className="w-full"
            draggable
            defaultExpandAll
            height={height}
            onSelect={(item) => (selectedSignal.value = item as Node)}
            onDrop={async (
              { dragNode: drag, dropNode: drop, dropNodePosition },
              event
            ) => {
              let position =
                dropNodePosition === TREE_NODE_DROP_POSITION.DRAG_OVER ? 0 : 1;
              if (!drag) {
                onDrop(
                  event,
                  drop?.data?.timePoint,
                  drop?.data?.channel,
                  position
                );
                return;
              }

              const dragNode = drag as Node;
              const dropNode = drop as Node;
              let changed = false;

              switch (dragNode.data.type) {
                case NodeType.TimePoint:
                  if (dropNode.data.type === NodeType.TimePoint) {
                    let timePoint = dropNode.data.timePoint;
                    if (dropNode.data.type !== NodeType.TimePoint) {
                      position = Position.AT;
                      timePoint += 1;
                    }

                    changed = loader.moveTimePoint(
                      dragNode.data.timePoint,
                      timePoint,
                      position
                    );
                  }
                  break;
                case NodeType.Channel:
                case NodeType.PlaceHolder:
                  if (dropNode.data.type === NodeType.TimePoint) {
                    if (
                      dropNodePosition === TREE_NODE_DROP_POSITION.DRAG_OVER
                    ) {
                      changed = loader.appendChannelToTimePoint(
                        dragNode.data.timePoint,
                        dragNode.data.channel,
                        dropNode.data.timePoint
                      );
                    }
                  } else {
                    changed = loader.moveChannel(
                      dragNode.data.timePoint,
                      dragNode.data.channel,
                      dropNode.data.timePoint,
                      dropNode.data.channel
                    );
                  }
                  break;
              }

              if (!changed) return;

              dataChanged();
            }}
            renderTreeNode={(node) => (
              <TreeNode node={node as Node} loader={loader} onDrop={onDrop} />
            )}
            renderTreeIcon={(node) =>
              node.children?.length ? null : undefined
            }
          />
        </div>
        {loading && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              background: "rgba(0, 0, 0, 0.5)",
            }}
          >
            <LoadingInd size="lg" content="Loading File" />
          </div>
        )}
      </div>
    </>
  );
};

const formatInt = (n: any) => String(Number.parseInt(String(n)));

function injectPlaceholders(data: DataTreeNode[], channels: number): Node[] {
  const final = [] as Node[];
  // Inject all the placeholders
  for (const [timePoint, node] of data.entries()) {
    const children = [] as Node[];

    for (let i = 0; i < channels; i++) {
      children.push({
        value: `missing-channel-${timePoint}-${i}`,
        data: {
          type: NodeType.PlaceHolder,
          channel: i,
          timePoint: timePoint,
        },
      });
    }

    if (node.channels) {
      for (const channel of node.channels) {
        children[channel.channel] = {
          value: `${timePoint}-${channel.channel}`,
          data: {
            type: NodeType.Channel,
            channel: channel.channel,
            timePoint,
            slices: channel.slices,
            width: channel.width,
            height: channel.height,
            name: channel.name,
          },
        };
      }
    }

    final.push({
      value: `${timePoint}`,
      data: {
        type: NodeType.TimePoint,
        timePoint,
        name: node.name,
      },
      children,
    });
  }

  return final;
}
