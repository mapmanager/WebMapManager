import { useEffect, useMemo, useRef } from "react";
import { PluginProps } from ".";
import { Table } from "rsuite";
import { DATA_VERSION, SELECTED_SPINE } from "./globals";
import { isAltKeyDown } from "../utils";
import { TableInstance } from "rsuite/esm/Table";

const { Column, HeaderCell, Cell } = Table;

const ROW_HEIGHT = 64;
export const TableView = ({
  loader,
  height,
  visible: visibleSignal,
}: PluginProps) => {
  const visible = visibleSignal.value;
  const tableRef = useRef<TableInstance<any, any>>(null);
  const [columns, names, data] = useMemo(() => {
    const stats = loader.table();
    if (!stats) return [[], []];
    const columns = stats.columns.to_list();
    const attributes = loader.columnsAttributes();
    return [
      columns.toJs(),
      columns.map((column: string) => attributes[column]?.title ?? column),
      stats.values
        .tolist()
        .toJs()
        .map((data: any[]) => ({ data })),
    ];
  }, [loader, DATA_VERSION.value]);

  const SPINE_ID = columns.indexOf("spineID");

  useEffect(() => {
    return SELECTED_SPINE.subscribe((spineId) => {
      if (!isAltKeyDown || !spineId || !tableRef.current || !visible) return;
      const idx = data.findIndex((d: any) => d.data[SPINE_ID] === spineId);
      console.log("scrolling to", spineId, idx, data);
      if (idx === -1) return;
      tableRef.current!.scrollTop(ROW_HEIGHT * idx);
    });
  }, [tableRef, SPINE_ID, data, visible]);

  return (
    <div style={{ background: "#1a1a1a" }}>
      <Table
        ref={tableRef}
        height={height}
        onRowClick={({ data }) => (SELECTED_SPINE.value = data[SPINE_ID])}
        data={data}
        rowHeight={ROW_HEIGHT}
        headerHeight={90}
      >
        {columns.map((name: string, index: number) => {
          return (
            <Column key={name} width={100} resizable>
              <HeaderCell>{names[index]}</HeaderCell>
              <Cell fullText>{(rowData) => {
                const data = rowData.data[index];
                if (Number.isNaN(data)) return "Invalid";
                return data;
        }}</Cell>
            </Column>
          );
        })}
      </Table>
    </div>
  );
};
