import { Sidenav, Nav, NavItemProps, NavProps } from "rsuite";
import { PyPixelSource } from "../loaders/py_loader";
import { Signal, signal, useSignal } from "@preact/signals-react";
import React, { useEffect, useMemo, useState } from "react";
import { Settings } from "../components/Settings";

export let NavBarElements = signal<any>(undefined);
const InspectorElements = signal<any>(undefined);

export const MainNavBar = ({ loader }: { loader: PyPixelSource }) => {
  const NavBarElementsComp = NavBarElements.value;
  const InspectorElementsComp = InspectorElements.value;
  const settingsOpen = useSignal(false);

  return (
    <>
      <Sidenav className="flex flex-col h-full" expanded={false}>
        <Sidenav.Body className="flex-grow border-b border-b-[#3c3f43] border-solid flex flex-col h-full justify-between">
          {NavBarElementsComp && NavBarElementsComp}
        </Sidenav.Body>
      </Sidenav>

      <Settings loader={loader} open={settingsOpen} />

      <div id="inspector" className={InspectorElementsComp ? "" : "hidden"}>
        {InspectorElementsComp && <InspectorElementsComp />}
      </div>
    </>
  );
};

export const InspectorNavBar = (
  props: NavProps & { activeKey: Signal<string | undefined> }
) => {
  const activeKey = props.activeKey as any;
  const children = props.children;
  const inspectors = useMemo(() => {
    let inspectors: Record<string, React.ComponentType<{}>> = {};
    if (!children) return inspectors;
    let c = children;
    if (!Array.isArray(c)) c = [c];
    for (const child of c) {
      if (
        !child ||
        !child.props ||
        !child.props.eventKey ||
        !child.props.Inspector
      )
        continue;

      inspectors[child.props.eventKey] = child.props.Inspector;
    }

    return inspectors;
  }, [children]);

  const aKey = activeKey.value;
  useEffect(() => {
    if (!aKey) {
      if (InspectorElements.peek() !== undefined)
        InspectorElements.value = undefined;
    } else if (InspectorElements.peek() !== inspectors[aKey!]) {
      InspectorElements.value = inspectors[aKey!];
    }
    return () => {
      if (InspectorElements.peek() !== undefined)
        InspectorElements.value = undefined;
    };
  }, [aKey, inspectors]);

  return (
    <Nav
      {...props}
      activeKey={aKey}
      onSelect={(v) => {
        activeKey.value = v === activeKey.value ? undefined : v;
      }}
    >
      {children}
    </Nav>
  );
};

export interface NavInspectorItemProps {
  Inspector: React.ComponentType<{}>;
}

export class NavInspectorItem extends React.Component<
  NavItemProps & NavInspectorItemProps
> {
  render() {
    const { Inspector: _, ...rest } = this.props;
    return <Nav.Item {...(rest as any)} />;
  }
}
