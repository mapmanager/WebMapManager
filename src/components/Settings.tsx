import { Signal } from "@preact/signals-react";
import { PixelSource } from "../loaders";
import { Form, InputNumber, Modal } from "rsuite";
import { DATA_VERSION } from "./plugins/globals";
import { useMemo } from "react";

export interface SettingsProps {
  loader: PixelSource;
  open: Signal<boolean>;
}

const InputWithType = ({
  loader,
  type,
  name,
  value,
}: {
  loader: PixelSource;
  type: string;
  name: string;
  value: any;
}) => {
  switch (type) {
    case "float":
      return (
        <Form.Control
          accepter={InputNumber}
          name={name}
          value={value}
          onChange={(newValue) => {
            loader.setAnalysisParams(name, parseFloat(newValue));
          }}
        />
      );
    case "int":
      return (
        <Form.Control
          accepter={InputNumber}
          name={name}
          value={value}
          onChange={(newValue) => {
            loader.setAnalysisParams(name, parseInt(newValue));
          }}
        />
      );
    default:
      return (
        <Form.Control
          name={name}
          type="text"
          value={value}
          onChange={(newValue) => {
            loader.setAnalysisParams(name, newValue);
          }}
        />
      );
  }
};

export const Settings = ({ loader, open }: SettingsProps) => {
  const dataVersion = DATA_VERSION.value;
  const settings = useMemo(() => {
    void dataVersion;
    return loader.analysisParams();
  }, [loader, dataVersion]);

  return (
    <Modal
      keyboard={false}
      open={open.value}
      onClose={() => (open.value = false)}
      size="sm"
      backdrop={true}
    >
      <Modal.Header>
        <Modal.Title>Settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form layout="horizontal" fluid>
          {Object.entries(settings).map(([name, value]) => (
            <Form.Group
              key={name}
              controlId={name}
              className="form-group-compressed"
            >
              <InputWithType
                loader={loader}
                type={value.type}
                name={name}
                value={value.value}
              />
              <Form.ControlLabel>
                {value.title}
                <Form.HelpText>{value.description}</Form.HelpText>
              </Form.ControlLabel>
            </Form.Group>
          ))}
        </Form>
      </Modal.Body>
      {/* <Modal.Footer className="flex gap-2 h-[30px]">
        <Button onClick={() => (open.value = false)} appearance="ghost">
          Close
        </Button>
      </Modal.Footer> */}
    </Modal>
  );
};
