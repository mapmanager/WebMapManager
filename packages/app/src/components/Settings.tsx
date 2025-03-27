import { Signal } from "@preact/signals-react";
import { Form, InputNumber, Modal } from "rsuite";
import { DATA_VERSION } from "../globals";
import { useMemo } from "react";
import { MapManagerMap } from "@map-manager/core";

export interface SettingsProps {
  map: MapManagerMap;
  open: Signal<boolean>;
}

const InputWithType = ({
  map,
  type,
  name,
  value,
}: {
  map: MapManagerMap;
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
            map.setAnalysisParams(name, parseFloat(newValue));
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
            map.setAnalysisParams(name, parseInt(newValue));
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
            map.setAnalysisParams(name, newValue);
          }}
        />
      );
  }
};

export const Settings = ({ map, open }: SettingsProps) => {
  const dataVersion = DATA_VERSION.value;
  const settings = useMemo(() => {
    void dataVersion;
    return map.analysisParams();
  }, [map, dataVersion]);

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
                map={map}
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
    </Modal>
  );
};
