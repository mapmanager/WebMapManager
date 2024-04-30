import React, { useMemo } from "react";
import { Table } from "rsuite";
import { FILTERS, SELECTED_SPINE } from "../globals";
import { Signal } from "@preact/signals-react";
import { ZRange } from ".";
import { PyPixelSourceTimePoint } from "../../../loaders/py_loader";

const { Column, HeaderCell, Cell } = Table;

interface SpineTableProps {
  loader: PyPixelSourceTimePoint;
  expandedRows: Signal<string[]>;
  selection: ZRange;
}

const spineRowSelected = (rowData: any) => {
  if (rowData.segment) return;
  SELECTED_SPINE.value = rowData.id;
};

const SelectableCell = ({
  selectedSpineId,
  ...props
}: any & {
  selectedSpineId?: string;
}) => {
  const isSpine = !props.rowData.segment;
  const selected = isSpine && props.rowData.id === selectedSpineId;
  return (
    <Cell
      {...props}
      className={
        (selected ? "selected" : "") +
        (isSpine
          ? " spine" + (props.rowData.invisible ? " invisible" : "")
          : "")
      }
    />
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
  const data = useMemo(() => {
    const segments = loader.getSegmentsAndSpines(selection, filter, true);
    return segments.map((seg) => ({
      id: "Segment " + seg.get("segmentID"),
      segment: true,
      children: seg.get("spines").map((d) => ({
        id: d.get("id"),
        type: d.get("type"),
        invisible: d.get("invisible"),
      })),
    }));
  }, [loader, selection, filter]);

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
      onExpandChange={(expanded, { id }) => {
        let rows = expandedRows.peek();
        let len = rows.length;
        if (!expanded) {
          rows = rows.filter((d) => d !== id);
          if (rows.length !== len) expandedRows.value = rows;
        } else {
          if (rows.indexOf(id) === -1) {
            expandedRows.value = [...rows, id];
          }
        }
      }}
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
          dataKey="id"
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
    </Table>
  );
};
