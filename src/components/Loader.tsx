// FIXME: remove once the loader is fully migrated
// import {
//   Button,
//   Form,
//   InputGroup,
//   InputNumber,
//   InputPicker,
//   Loader as LoadingInd,
//   Modal,
// } from "rsuite";
// import { Tree, IconButton } from "rsuite";
// import { useMemo, useState } from "react";
// import TrashIcon from "@rsuite/icons/Trash";
// import EditIcon from "@rsuite/icons/Edit";
// import { TREE_NODE_DROP_POSITION } from "rsuite/esm/internals/constants";
// import FileUploadIcon from "@rsuite/icons/FileUpload";
// import { Signal, useSignal } from "@preact/signals-react";
// import HistoryIcon from "@rsuite/icons/History";
// import useResizeObserver from "use-resize-observer";
// import { PluginProps } from "../components/plugins";
// import { DATA_VERSION, dataChanged } from "../components/plugins/globals";
// import { DataTreeNode, Position, PyPixelSource } from "../loaders/py_loader";
// import { PixelSource } from "../loaders";
// import { multiTimePointEnabled } from "../config";

// const unitTypes = [
//   "m",
//   "dm",
//   "cm",
//   "mm",
//   "µm",
//   "nm",
//   "pm",
//   "fm",
//   "am",
//   "zm",
//   "ym",
// ].map((item) => ({
//   label: item,
//   value: item,
// }));

// const enum NodeType {
//   TimePoint = "time",
//   Channel = "channel",
//   PlaceHolder = "placeholder",
// }

// interface Node {
//   value: string;
//   data:
//     | {
//         type: NodeType.TimePoint;
//         timePoint: number;
//         name: string;
//       }
//     | {
//         type: NodeType.Channel;
//         timePoint: number;
//         channel: number;
//         slices: number;
//         width: number;
//         height: number;
//         name: string;
//       }
//     | {
//         type: NodeType.PlaceHolder;
//         timePoint: number;
//         channel: number;
//       };
//   children?: Node[];
// }

// const TreeNode = ({
//   node,
//   loader,
//   onDrop,
// }: {
//   node: Node;
//   loader: PluginProps["loader"];
//   onDrop: (event: React.DragEvent, timePoint: number, channel: number) => void;
// }) => {
//   const [open, setOpen] = useState(false);
//   if (node.data.type === NodeType.TimePoint) {
//     return (
//       <div>
//         <div className="flex items-center w-full font-extrabold text-lg">
//           <div className="flex flex-col gap-1 w-full">
//             <div className="font-bold text-base">{node.data.name}</div>
//             {multiTimePointEnabled && (
//               <div className="text-sm">
//                 Time Point {node.data.timePoint + 1}
//               </div>
//             )}
//           </div>
//           <div className="pl-2 text-sm text-gray-400">
//             (
//             {node.children?.reduce(
//               (c, child) => (child.data.type === NodeType.Channel ? c + 1 : c),
//               0
//             ) ?? 0}
//             )
//           </div>
//           <div className="ml-2" />
//           <IconButton
//             className="shrink-0 ml-2"
//             icon={<EditIcon />}
//             onClick={() => {
//               setOpen(true);
//             }}
//           >
//             Edit
//           </IconButton>
//           {open && (
//             <ImageMetaDataInspector
//               loader={loader}
//               node={node}
//               open={open}
//               setOpen={setOpen}
//             />
//           )}
//         </div>
//       </div>
//     );
//   }

//   if (node.data.type === NodeType.PlaceHolder) {
//     return (
//       <div className="flex flex-row gap-4 items-center bg-red-950 rounded pr-3">
//         <div className="w-[50px] h-[50px] flex-shrink-0 flex flex-col justify-center align-middle">
//           <div className="text-white text-center text-xs font-extrabold">
//             t{node.data.timePoint + 1}c{node.data.channel + 1}
//           </div>
//         </div>
//         <div className="flex flex-col gap-1 w-full">
//           <div className="font-bold text-base">Missing Channel</div>
//           <div className="text-sm">Channel {node.data.channel + 1}</div>
//         </div>
//         <IconButton
//           className="shrink-0"
//           icon={<FileUploadIcon />}
//           onClick={() => {
//             const input = document.createElement("input");
//             input.type = "file";
//             input.accept = ".mmap,.tif";
//             input.multiple = false;
//             input.onchange = (event) => {
//               event.preventDefault();
//               event.stopPropagation();
//               const target = event.target as HTMLInputElement;
//               if (target.files) {
//                 onDrop(
//                   {
//                     dataTransfer: { files: target.files },
//                   } as any,
//                   (node.data as any).timePoint,
//                   (node.data as any).channel
//                 );
//               }
//             };
//             input.click();
//           }}
//         >
//           Open file
//         </IconButton>
//       </div>
//     );
//   }

//   return (
//     <div className="flex flex-row gap-4 items-center">
//       <div className="w-[50px] h-[50px] flex-shrink-0 bg-black flex flex-col justify-center align-middle">
//         <div className="text-white text-center text-xs font-extrabold">
//           t{node.data.timePoint + 1}c{node.data.channel + 1}
//         </div>
//       </div>
//       <div className="flex flex-col gap-1 w-full">
//         <div className="font-bold text-base">{node.data.name}</div>
//         <div className="text-sm">Channel {node.data.channel + 1}</div>
//       </div>
//       <div className="pl-2 text-xs text-gray-400 flex-shrink-0">
//         Slices: {node.data.slices}
//         <br />({node.data.width}x{node.data.width})
//       </div>
//       <div className="ml-auto" />
//       <IconButton
//         className="shrink-0 ml-2"
//         icon={<EditIcon />}
//         onClick={() => {
//           setOpen(true);
//         }}
//       >
//         Edit
//       </IconButton>
//       {open && (
//         <ChannelMetaDataInspector
//           loader={loader}
//           node={node}
//           open={open}
//           setOpen={setOpen}
//         />
//       )}
//     </div>
//   );
// };

// export const Loader = ({
//   loader,
//   open,
// }: {
//   loader: PixelSource;
//   open: Signal<boolean>;
// }) => {
//   const [loading, setLoading] = useState(false);
//   const selectedSignal = useSignal(undefined as Node | undefined);
//   const dataVersion = DATA_VERSION.value;

//   const treeData = useMemo(() => {
//     const channels = loader.maxChannels();
//     const treeData = injectPlaceholders(loader.dataTree(), channels);

//     for (const timePoint of treeData) {
//       for (const channel of timePoint.children ?? []) {
//         if (selectedSignal.value?.value === channel.value) {
//           return treeData;
//         }
//       }
//     }

//     selectedSignal.value = undefined;

//     return treeData;
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [dataVersion, loader, selectedSignal]);

//   const onDrop = async (
//     event: React.DragEvent,
//     timePoint: number,
//     channel: number,
//     dropNodePosition: Position = 0
//   ) => {
//     const droppedFiles = event.dataTransfer?.files;
//     if (!droppedFiles) return;

//     setLoading(true);

//     for (const file of droppedFiles) {
//       if (file.name.endsWith(".tif")) {
//         await loader.merge(file, timePoint, channel, dropNodePosition);
//         continue;
//       }
//       alert("Invalid file type. Please upload a '.tif' file.");
//       setLoading(false);
//       return;
//     }
//     setLoading(false);
//     dataChanged();
//   };
//   const { ref, height = 1 } = useResizeObserver<HTMLDivElement>();

//   return (
//     <Modal
//       keyboard={false}
//       open={open.value}
//       onClose={() => (open.value = false)}
//       size="full"
//     >
//       <Modal.Header>
//         <Modal.Title>{loader.name}</Modal.Title>
//       </Modal.Header>
//       <Modal.Body>
//         <div
//           style={{ background: "#1a1a1a" }}
//           ref={ref}
//           className="relative h-full w-full flex flex-col"
//           onDrop={(e) => {
//             e.preventDefault();
//             e.stopPropagation();
//             onDrop(e, treeData.length, 0);
//           }}
//           onDragOver={(event) => event.preventDefault()}
//         >
//           <Tree
//             data={treeData}
//             className="w-full"
//             draggable
//             defaultExpandAll
//             expandItemValues={multiTimePointEnabled ? undefined : ["0"]}
//             height={height}
//             onSelect={(item) => (selectedSignal.value = item as Node)}
//             onDrop={async (
//               { dragNode: drag, dropNode: drop, dropNodePosition },
//               event
//             ) => {
//               let position =
//                 dropNodePosition === TREE_NODE_DROP_POSITION.DRAG_OVER ? 0 : 1;
//               if (!drag) {
//                 onDrop(
//                   event,
//                   drop?.data?.timePoint,
//                   drop?.data?.channel,
//                   position
//                 );
//                 return;
//               }

//               const dragNode = drag as Node;
//               const dropNode = drop as Node;
//               let changed = false;

//               switch (dragNode.data.type) {
//                 case NodeType.TimePoint:
//                   if (dropNode.data.type === NodeType.TimePoint) {
//                     let timePoint = dropNode.data.timePoint;
//                     if (dropNode.data.type !== NodeType.TimePoint) {
//                       position = Position.AT;
//                       timePoint += 1;
//                     }

//                     changed = loader.moveTimePoint(
//                       dragNode.data.timePoint,
//                       timePoint,
//                       position
//                     );
//                   }
//                   break;
//                 case NodeType.Channel:
//                 case NodeType.PlaceHolder:
//                   if (dropNode.data.type === NodeType.TimePoint) {
//                     if (
//                       dropNodePosition === TREE_NODE_DROP_POSITION.DRAG_OVER
//                     ) {
//                       changed = loader.appendChannelToTimePoint(
//                         dragNode.data.timePoint,
//                         dragNode.data.channel,
//                         dropNode.data.timePoint
//                       );
//                     }
//                   } else {
//                     changed = loader.moveChannel(
//                       dragNode.data.timePoint,
//                       dragNode.data.channel,
//                       dropNode.data.timePoint,
//                       dropNode.data.channel
//                     );
//                   }
//                   break;
//               }

//               dataChanged(changed);
//             }}
//             renderTreeNode={(node) => (
//               <TreeNode node={node as Node} loader={loader} onDrop={onDrop} />
//             )}
//             renderTreeIcon={(node) =>
//               multiTimePointEnabled && node.children?.length ? null : undefined
//             }
//           />
//           {loading && (
//             <div
//               style={{
//                 position: "absolute",
//                 top: 0,
//                 left: 0,
//                 right: 0,
//                 bottom: 0,
//                 display: "flex",
//                 justifyContent: "center",
//                 alignItems: "center",
//                 background: "rgba(0, 0, 0, 0.5)",
//               }}
//             >
//               <LoadingInd size="lg" content="Loading File" />
//             </div>
//           )}
//         </div>
//       </Modal.Body>
//       <Modal.Footer className="flex gap-2 h-[30px]">
//         <IconButton
//           icon={<FileUploadIcon />}
//           appearance="ghost"
//           size="sm"
//           onClick={() => {
//             PyPixelSource.Load(() => setLoading(true))
//               .catch((error) => {
//                 if (error.message !== "User cancelled")
//                   alert("Failed to load project");
//               })
//               .finally(() => setLoading(false));
//           }}
//         >
//           Open Project
//         </IconButton>
//         <IconButton
//           icon={<TrashIcon />}
//           appearance="primary"
//           color="red"
//           size="sm"
//           onClick={() => {
//             PyPixelSource.empty();
//           }}
//         >
//           New Project
//         </IconButton>
//         <div className="flex-grow" />
//         {multiTimePointEnabled && (
//           <IconButton
//             icon={<HistoryIcon />}
//             appearance="primary"
//             size="sm"
//             onClick={() => {
//               dataChanged(loader.createTimePoint());
//             }}
//           >
//             Create Time Point
//           </IconButton>
//         )}
//         <Button onClick={() => (open.value = false)} appearance="ghost">
//           Done
//         </Button>
//       </Modal.Footer>
//     </Modal>
//   );
// };

// const formatInt = (n: any) => String(Number.parseInt(String(n)));

// function ChannelMetaDataInspector({
//   loader,
//   node,
//   open,
//   setOpen,
// }: {
//   loader: PyPixelSource;
//   node: Node;
//   open: boolean;
//   setOpen: (open: boolean) => void;
// }) {
//   const [value, setValue] = useState(() => {
//     const value = {
//       name: (node?.data as any)?.name ?? "Unnamed",
//       channel:
//         (node?.data?.type === NodeType.Channel ? node?.data?.channel : 0) + 1,
//       timePoint: ((node?.data as any)?.timePoint ?? 0) + 1,
//     } as Record<string, any>;
//     return value;
//   });
//   const channels = loader.maxChannels();

//   return (
//     <Modal
//       keyboard={false}
//       open={open}
//       onClose={() => setOpen(false)}
//       backdrop={true}
//     >
//       <Modal.Header>
//         <Modal.Title>Channel Meta Data</Modal.Title>
//       </Modal.Header>
//       <Modal.Body>
//         <Form
//           fluid
//           formValue={value}
//           onChange={(v) => setValue({ ...v } as any)}
//           className="flex flex-col overflow-hidden flex-grow"
//         >
//           <Form.Group controlId="name">
//             <Form.ControlLabel>Name</Form.ControlLabel>
//             <Form.Control name="name" />

//             <Form.HelpText>The name of the imported image set</Form.HelpText>
//           </Form.Group>
//           <Form.Group controlId="channel">
//             <Form.ControlLabel>Channel</Form.ControlLabel>
//             <Form.Control
//               name="channel"
//               type="number"
//               min={1}
//               accepter={InputNumber}
//               max={channels}
//               formatter={formatInt}
//             />
//           </Form.Group>
//           {multiTimePointEnabled && (
//             <Form.Group controlId="timePoint">
//               <Form.ControlLabel>Time Point</Form.ControlLabel>
//               <Form.Control
//                 name="timePoint"
//                 type="number"
//                 accepter={InputNumber}
//                 min={1}
//                 formatter={formatInt}
//               />
//             </Form.Group>
//           )}
//         </Form>
//       </Modal.Body>
//       <Modal.Footer className="flex gap-2">
//         <IconButton
//           color="red"
//           appearance="primary"
//           icon={<TrashIcon />}
//           onClick={() => {
//             dataChanged(loader.deleteChannel(
//               node.data.timePoint,
//               (node.data as any).channel
//             ));
//             setOpen(false);
//           }}
//         >
//           Delete
//         </IconButton>
//         <div className="flex-grow" />
//         <Button onClick={() => setOpen(false)} appearance="ghost">
//           Cancel
//         </Button>
//         <Button
//           appearance="primary"
//           type="submit"
//           onClick={() => {
//             if (value) {
//               const result = loader.updateChannel(
//                 node?.data.timePoint,
//                 (node?.data as any).channel,
//                 value
//               );
//               dataChanged(result);
//             }
//             setOpen(false);
//           }}
//         >
//           Save
//         </Button>
//       </Modal.Footer>
//     </Modal>
//   );
// }

// function ImageMetaDataInspector({
//   loader,
//   node,
//   open,
//   setOpen,
// }: {
//   loader: PyPixelSource;
//   node: Node;
//   open: boolean;
//   setOpen: (open: boolean) => void;
// }) {
//   const [value, setValue] = useState(() => {
//     const value = {
//       name: (node?.data as any)?.name ?? "Unnamed",
//       channel:
//         (node?.data?.type === NodeType.Channel ? node?.data?.channel : 0) + 1,
//       timePoint: ((node?.data as any)?.timePoint ?? 0) + 1,
//     } as Record<string, any>;
//     if (node?.data.type === NodeType.TimePoint) {
//       const metadata = loader.metadata(node?.data.timePoint);
//       const physicalSize = metadata["physicalSize"];
//       value["physicalSizeX"] = physicalSize["x"];
//       value["physicalSizeY"] = physicalSize["y"];
//       value["physicalSizeUnit"] = physicalSize["unit"];
//     }
//     return value;
//   });

//   return (
//     <Modal
//       keyboard={false}
//       open={open}
//       onClose={() => setOpen(false)}
//       backdrop={true}
//     >
//       <Modal.Header>
//         <Modal.Title>
//           {multiTimePointEnabled ? "Time Point" : "Data Set"} Meta Data
//         </Modal.Title>
//       </Modal.Header>
//       <Modal.Body>
//         <Form
//           fluid
//           formValue={value}
//           onChange={(v) => setValue({ ...v } as any)}
//           className="flex flex-col overflow-hidden flex-grow"
//         >
//           <Form.Group controlId="name">
//             <Form.ControlLabel>Name</Form.ControlLabel>
//             <Form.Control name="name" />
//           </Form.Group>
//           {multiTimePointEnabled && (
//             <Form.Group controlId="timePoint">
//               <Form.ControlLabel>Time Point</Form.ControlLabel>
//               <Form.Control
//                 name="timePoint"
//                 type="number"
//                 accepter={InputNumber}
//                 min={1}
//                 formatter={formatInt}
//               />
//             </Form.Group>
//           )}
//           <Form.Group controlId="physical-size">
//             <Form.ControlLabel>Physical Size</Form.ControlLabel>
//             <InputGroup>
//               <InputGroup.Addon>X</InputGroup.Addon>
//               <Form.Control
//                 name="physicalSizeX"
//                 type="number"
//                 accepter={InputNumber}
//                 min={1}
//                 formatter={formatInt}
//               />
//               <InputGroup.Addon>Y</InputGroup.Addon>
//               <Form.Control
//                 name="physicalSizeY"
//                 type="number"
//                 accepter={InputNumber}
//                 min={1}
//                 formatter={formatInt}
//               />
//             </InputGroup>
//             <Form.ControlLabel className="pt-2">Unit</Form.ControlLabel>
//             <Form.Control
//               name="physicalSizeUnit"
//               accepter={InputPicker}
//               data={unitTypes}
//               style={{ width: "100%" }}
//             />
//           </Form.Group>
//         </Form>
//       </Modal.Body>
//       <Modal.Footer className="flex gap-2">
//         {multiTimePointEnabled && (
//           <IconButton
//             color="red"
//             appearance="primary"
//             icon={<TrashIcon />}
//             onClick={() => {
//               if (loader.deleteTimePoint(node.data.timePoint)) {
//                 dataChanged();
//               }
//               setOpen(false);
//             }}
//           >
//             Delete
//           </IconButton>
//         )}
//         <div className="flex-grow" />
//         <Button onClick={() => setOpen(false)} appearance="ghost">
//           Cancel
//         </Button>
//         <Button
//           appearance="primary"
//           type="submit"
//           onClick={() => {
//             if (value) {
//               const result = loader.updateTimePoint(
//                 node?.data.timePoint,
//                 value
//               );
//               dataChanged(result);
//             }
//             setOpen(false);
//           }}
//         >
//           Save
//         </Button>
//       </Modal.Footer>
//     </Modal>
//   );
// }

// function injectPlaceholders(data: DataTreeNode[], channels: number): Node[] {
//   const final = [] as Node[];
//   // Inject all the placeholders
//   for (const [timePoint, node] of data.entries()) {
//     const children = [] as Node[];

//     for (let i = 0; i < channels; i++) {
//       children.push({
//         value: `missing-channel-${timePoint}-${i}`,
//         data: {
//           type: NodeType.PlaceHolder,
//           channel: i,
//           timePoint: timePoint,
//         },
//       });
//     }

//     if (node.channels) {
//       for (const channel of node.channels) {
//         children[channel.channel] = {
//           value: `${timePoint}-${channel.channel}`,
//           data: {
//             type: NodeType.Channel,
//             channel: channel.channel,
//             timePoint,
//             slices: channel.slices,
//             width: channel.width,
//             height: channel.height,
//             name: channel.name,
//           },
//         };
//       }
//     }

//     final.push({
//       value: `${timePoint}`,
//       data: {
//         type: NodeType.TimePoint,
//         timePoint,
//         name: node.name,
//       },
//       children,
//     });
//   }

//   return final;
// }
