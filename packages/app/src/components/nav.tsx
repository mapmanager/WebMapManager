import { Nav, NavItemProps, NavProps, Sidenav } from "rsuite";
import { Signal, signal, useSignal } from "@preact/signals-react";
import React, { ReactElement, useContext, useEffect, useMemo } from "react";
import { Settings } from "../components/Settings";
import { ActivePlugin } from "./layout";
import { MapManagerMap } from "@map-manager/core";

/** Tracks the active nav bar items */
export let NavBarElements = signal<any>(undefined);
/** Tracks the active inspector element */
const InspectorElements = signal<any>(undefined);

/**
 * Nev bar for components. All the children of the nave bar component are
 * attached to the global nave bar when the view is active.
 */
export const NavBar = ({
  children: Children,
}: {
  children: undefined | ReactElement<{}, any> | any;
}) => {
  const active = useContext(ActivePlugin);
  useEffect(() => {
    if (!active || !Children) return;

    NavBarElements.value = Children;

    return () => {
      NavBarElements.value = undefined;
    };
  }, [active, Children]);

  return <></>;
};

/**
 * The main navigation bar component for the application. This component
 */
export const MainNavBar = ({ map }: { map: MapManagerMap }) => {
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

      <Settings map={map} open={settingsOpen} />

      <div id="inspector" className={InspectorElementsComp ? "" : "hidden"}>
        {InspectorElementsComp && <InspectorElementsComp />}
      </div>
    </>
  );
};

/**
 * A navigation item component that includes an associated inspector component.
 * This component is used within the `InspectorNavBar` to define selectable items
 * with corresponding inspector views. Similar to `Nav.Item`, but with an additional
 * `Inspector` property.
 *
 * @param props - The properties for the navigation item, including:
 *   - `Inspector`: The React component to be rendered as the inspector panel.
 *   - Other `NavItemProps` for customization.
 */
export const InspectorNavBar = (
  props: NavProps & { activeKey: Signal<string | undefined> },
) => {
  const activeKey = props.activeKey as any;
  const children = props.children;

  // Extract all the inspectors from the children
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
      ) {
        continue;
      }

      inspectors[child.props.eventKey] = child.props.Inspector;
    }

    return inspectors;
  }, [children]);

  const aKey = activeKey.value;

  // Update the inspector element when the active key changes
  useEffect(() => {
    if (!aKey) {
      if (InspectorElements.peek() !== undefined) {
        InspectorElements.value = undefined;
      }
    } else if (InspectorElements.peek() !== inspectors[aKey!]) {
      InspectorElements.value = inspectors[aKey!];
    }
    return () => {
      if (InspectorElements.peek() !== undefined) {
        InspectorElements.value = undefined;
      }
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

/**
 * A navigation item component that includes an associated inspector component.
 */
export interface NavInspectorItemProps {
  Inspector: React.ComponentType<{}>;
}

export class NavInspectorItem extends React.Component<
  NavItemProps & NavInspectorItemProps
> {
  render() {
    // The Inspector component is extracted from the props by looping through
    // the children on render
    const { Inspector: _, ...rest } = this.props;
    return <Nav.Item {...(rest as any)} />;
  }
}
