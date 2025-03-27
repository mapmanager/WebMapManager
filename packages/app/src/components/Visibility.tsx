import { useCallback } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

export interface VisibilityControlProps {
  visible: boolean;
  onChange: (visible: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Eye component that represents a visibility control
 * FIXME: Should not be in the core move to a ui package
 */
export const VisibilityControl = ({
  visible,
  onChange,
  children,
}: VisibilityControlProps) => {
  const onClick = useCallback(() => onChange(!visible), [visible, onChange]);
  return (
    <div className="visible-container">
      {children && <label onClick={onClick}>{children}</label>}
      {visible
        ? <AiOutlineEye className="visible" onClick={onClick} />
        : <AiOutlineEyeInvisible className="visible" onClick={onClick} />}
    </div>
  );
};
