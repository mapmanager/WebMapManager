import React, { useCallback, useMemo } from "react";
import { Table } from "rsuite";
import {
  DATA_VERSION,
  EDITING_SEGMENT,
  EDITING_SEGMENT_PATH,
  FILTERS,
  SELECTED_SEGMENT,
  SELECTED_SPINE,
  dataChanged,
} from "../globals";
import { Signal, batch } from "@preact/signals-react";
import { ZRange } from ".";
import { PyPixelSourceTimePoint } from "../../../loaders/py_loader";
import { IconButton } from "rsuite";
import PlusIcon from "@rsuite/icons/Plus";
import DeleteIcon from "@rsuite/icons/Trash";

const { Column, HeaderCell, Cell } = Table;

interface SpineTableProps {
  loader: PyPixelSourceTimePoint;
  expandedRows: Signal<string[]>;
  selection: ZRange;
}

const SelectableCell = ({
  selectedSpineId,
  ...props
}: any & {
  selectedSpineId?: string;
}) => {
  const isSpine = !props.rowData.segment;
  const selected = isSpine && props.rowData._id === selectedSpineId;
  return (
    <Cell
      {...props}
      className={
        (selected ? "selected" : "") +
        (isSpine
          ? " spine" + (props.rowData.invisible ? " invisible" : "")
          : "segment-cell")
      }
    />
  );
};

const ActionCell = ({
  selectedSpineId,
  ...props
}: any & {
  selectedSpineId?: string;
}) => {
  if (!props.rowData.segment)
    return (
      <Cell {...props}>
        <></>
      </Cell>
    );
  return (
    <Cell {...props}>
      <></>
      <IconButton
        appearance="subtle"
        size="xs"
        icon={<DeleteIcon />}
        className="icon-button"
        disabled={props.rowData.children.length > 0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
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

export const SpineTable = ({
  loader,
  selection,
  expandedRows,
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
    [expandedRows]
  );

  const data = useMemo(() => {
    const segments = loader.getSegmentsAndSpines(selection, filter, true);
    return segments.map((seg) => ({
      id: "segment" + seg.get("segmentID"),
      _id: Number(seg.get("segmentID")),
      title: "Segment " + (Number(seg.get("segmentID")) + 1),
      segment: true,
      onClick: (id: number) => {
        if (loader.deleteSegment(id)) {
          batch(() => {
            console.log("Deleted segment", id, EDITING_SEGMENT_PATH.peek(), SELECTED_SEGMENT.peek(), EDITING_SEGMENT.peek())
            if (EDITING_SEGMENT_PATH.peek() === id) {
              EDITING_SEGMENT_PATH.value = undefined;
            }
            if (SELECTED_SEGMENT.peek() === id) {
              SELECTED_SEGMENT.value = undefined;
            }
            if (EDITING_SEGMENT.peek() === id) {
              EDITING_SEGMENT.value = undefined;
            }
            dataChanged();
          });
        }
      },
      children: seg.get("spines").map((d) => ({
        id: Number(d.get("id")),
        _id: Number(d.get("id")),
        title: "" + (Number(d.get("id")) + 1),
        type: d.get("type"),
        invisible: d.get("invisible"),
      })),
    }));
  }, [loader, selection, filter, DATA_VERSION.value]);

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
        <HeaderCell style={{ padding: 4, paddingTop: 18 }}> </HeaderCell>
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
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.blur();
              const id = Number(loader.newSegment());
              EDITING_SEGMENT.value = id;
              EDITING_SEGMENT_PATH.value = id;
              SELECTED_SEGMENT.value = id;
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