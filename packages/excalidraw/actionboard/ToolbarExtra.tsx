import { useTunnels } from "../context/tunnels";

// Host-provided extras rendered beside the shapes toolbar, in the slot the
// laser-pointer island occupies (FooterCenter pattern: children teleport to
// the <ABToolbarExtraTunnel.Out /> in LayerUI's toolbar Stack.Row). Purely a
// placement slot — the host owns the buttons' markup and styling.
const ToolbarExtra = ({ children }: { children?: React.ReactNode }) => {
  const { ABToolbarExtraTunnel } = useTunnels();
  return <ABToolbarExtraTunnel.In>{children}</ABToolbarExtraTunnel.In>;
};

export default ToolbarExtra;
ToolbarExtra.displayName = "ToolbarExtra";
