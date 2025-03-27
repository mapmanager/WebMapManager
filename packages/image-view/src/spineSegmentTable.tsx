import React, { useCallback, useMemo, useRef } from "react";
import { Popover, Table, Whisper } from "rsuite";
import {
  DATA_VERSION,
  dataChanged,
  FILTERS,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
} from "@map-manager/app";
import { batch, Signal } from "@preact/signals-react";
import { SegmentEditMode, ZRange } from ".";
import { MapManagerTimePointMap } from "@map-manager/app";
import { IconButton } from "rsuite";
import PlusIcon from "@rsuite/icons/Plus";
import DeleteIcon from "@rsuite/icons/Trash";
import { CirclePicker } from "react-color";
import { COLORS_SELECTOR_OPTIONS } from "./colorPicker";

const { Column, HeaderCell, Cell } = Table;

interface SpineTableProps {
  map: MapManagerTimePointMap;
  expandedRows: Signal<string[]>;
  selection: ZRange;
  editingSegmentSignal: Signal<number | undefined>;
  editMode: Signal<SegmentEditMode>;
}

const SelectableCell = ({
  selectedSpineId,
  ...props
}: any & {
  selectedSpineId?: string;
}) => {
  const isSpine = !props.rowData.segment;
  const selected = isSpine && props.rowData._id === selectedSpineId;

  if (props.dataKey == "type" && !isSpine) {
    const r = props.rowData.color.get(0);
    const g = props.rowData.color.get(1);
    const b = props.rowData.color.get(2);
    const speaker = (
      <Popover>
        <CirclePicker
          color={{ r, g, b }}
          colors={COLORS_SELECTOR_OPTIONS}
          onChange={({ rgb: { r, g, b } }) => {
            props.rowData.setColor(props.rowData._id, [r, g, b]);
          }}
        />
      </Popover>
    );
    return (
      <Cell
        {...props}
        className={(selected ? "selected" : "") +
          (isSpine
            ? " spine" + (props.rowData.invisible ? " invisible-cell" : "")
            : "segment-cell")}
      >
        <div
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Whisper trigger="click" placement="auto" speaker={speaker}>
            <div
              style={{
                width: 26,
                height: 20,
                backgroundColor: `rgb(${r},${g},${b})`,
                borderRadius: 4,
              }}
            >
            </div>
          </Whisper>
        </div>
      </Cell>
    );
  }

  return (
    <Cell
      {...props}
      className={(selected ? "selected" : "") +
        (isSpine
          ? " spine" + (props.rowData.invisible ? " invisible-cell" : "")
          : "segment-cell")}
    />
  );
};

const ActionCell = ({
  selectedSpineId,
  ...props
}: any & {
  selectedSpineId?: string;
}) => {
  if (!props.rowData.segment) {
    return (
      <Cell {...props}>
        <></>
      </Cell>
    );
  }

  return (
    <Cell {...props}>
      <IconButton
        appearance="subtle"
        size="xs"
        icon={<DeleteIcon />}
        className="icon-button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
          if (props.rowData.children.length > 0) {
            alert("Cannot delete segment with spines");
            return;
          }
          props.rowData.onClick(props.rowData._id);
        }}
      />
    </Cell>
  );
};

const NoSegments = () => {
  return (
    <div className="segment-not-found-c">
      <div>No Segment Annotations</div>
    </div>
  );
};

/**
 * Inspector Table for displaying the tree of segments and spines
 */
export const SpineTable = ({
  map,
  selection,
  expandedRows,
  editingSegmentSignal,
  editMode,
}: SpineTableProps) => {
  const filter = FILTERS.value;

  const spineRowSelected = useCallback(
    (rowData: any, event: any) => {
      event.stopPropagation();
      if (rowData.segment) {
        const id = rowData.id;
        let rows = expandedRows.peek();
        const len = rows.length;
        if (rows.indexOf(id) === -1) {
          expandedRows.value = [...rows, id];
          return;
        }
        rows = rows.filter((d) => d !== id);
        if (rows.length !== len) expandedRows.value = rows;
        return;
      }
      SELECTED_SPINE.value = rowData._id;
    },
    [expandedRows],
  );

  const data = useMemo(() => {
    const segments = map.getSegmentsAndSpines(selection, filter, true);
    return segments.map((seg) => ({
      id: "segment" + seg.get("segmentID"),
      _id: Number(seg.get("segmentID")),
      title: "Segment " + Number(seg.get("segmentID")),
      segment: true,
      color: seg.get("color"),
      setColor: (id: number, color: [number, number, number]) => {
        dataChanged(map.setSegmentColor(id, color));
      },
      onClick: (id: number) => {
        if (map.deleteSegment(id)) {
          batch(() => {
            if (SELECTED_SEGMENT.peek() === id) {
              SELECTED_SEGMENT.value = undefined;
            }
            if (editingSegmentSignal.peek() === id) {
              editingSegmentSignal.value = undefined;
            }
            dataChanged();
          });
        }
      },
      children: seg.get("spines").map((d) => ({
        id: Number(d.get("id")),
        _id: Number(d.get("id")),
        title: "" + Number(d.get("id")),
        color: undefined,
        type: d.get("type"),
        invisible: d.get("invisible"),
      })),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selection, filter, DATA_VERSION.value, editingSegmentSignal]);

  const selectedSpineId = SELECTED_SPINE.value;
  return (
    <Table
      data={data as any}
      isTree
      expandedRowKeys={expandedRows.value}
      hover={false}
      fillHeight={true}
      rowHeight={30}
      headerHeight={46}
      rowKey="id"
      onRowClick={spineRowSelected}
      renderEmpty={NoSegments}
      virtualized
    >
      <Column width={30} treeCol align="left">
        <HeaderCell style={{ padding: 4, paddingTop: 18 }} children={undefined}>
        </HeaderCell>
        <SelectableCell
          selectedSpineId={selectedSpineId}
          style={{ padding: 4 }}
        />
      </Column>
      <Column flexGrow={1} align="left">
        <HeaderCell style={{ padding: 4, paddingTop: 18 }}>Id</HeaderCell>
        <SelectableCell
          selectedSpineId={selectedSpineId}
          style={{ padding: 4 }}
          dataKey="title"
        />
      </Column>
      <Column width={44} align="right">
        <HeaderCell style={{ padding: 4, paddingTop: 18 }}>Type</HeaderCell>
        <SelectableCell
          selectedSpineId={selectedSpineId}
          style={{ padding: 4, color: "gray", fontSize: 14, lineHeight: 1.5 }}
          dataKey="type"
        />
      </Column>
      <Column width={44} align="right">
        <HeaderCell style={{ padding: 4, paddingTop: 18 }}>
          <IconButton
            appearance="subtle"
            size="xs"
            icon={<PlusIcon />}
            className="icon-button"
            disabled={map!.shape[0] === 0}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.blur();
              const id = Number(map.newSegment());
              editingSegmentSignal.value = id;
              SELECTED_SEGMENT.value = id;
              editMode.value = SegmentEditMode.Path;
              dataChanged();
            }}
          />
        </HeaderCell>
        <ActionCell
          selectedSpineId={selectedSpineId}
          style={{ padding: 4, color: "gray", fontSize: 14, lineHeight: 1.5 }}
          dataKey="id"
        />
      </Column>
    </Table>
  );
};
