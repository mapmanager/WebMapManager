import { useCallback } from "react";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

interface Props {
  visible: boolean;
  onChange: (visible: boolean) => void;
  children?: any;
}

/**
 * Eye component that represents a visibility control
 */
export const VisibilityControl = ({ visible, onChange, children }: Props) => {
  const onClick = useCallback(() => onChange(!visible), [visible, onChange]);
  return (
    <div className="visible-container">
      {children && <label onClick={onClick}>{children}</label>}
      {visible ? (
        <AiOutlineEye className="visible" onClick={onClick} />
      ) : (
        <AiOutlineEyeInvisible className="visible" onClick={onClick} />
      )}
    </div>
  );
};
