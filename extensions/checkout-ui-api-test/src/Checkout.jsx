import {
  reactExtension,
  Banner,
  BlockStack,
  Checkbox,
  Text,
  useApi,
  useApplyAttributeChange,
  useInstructions,
  useTranslate,
} from "@shopify/ui-extensions-react/checkout";
import { useEffect, useState } from "react";

const VARIANT_ID = "42093858455634";
const BACKEND_URL = "https://andrea-fibre-local-slim.trycloudflare.com";
const TEST_LOCATION_ID = "gid://shopify/Location/65264123986"; // Replace with a real location ID

export default reactExtension("purchase.checkout.block.render", () => (
  <Extension />
));

function Extension() {
  const translate = useTranslate();
  const { extension } = useApi();
  const instructions = useInstructions();
  const applyAttributeChange = useApplyAttributeChange();
  const [backendResponse, setBackendResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_URL}/inventory?locationId=${encodeURIComponent(TEST_LOCATION_ID)}&variantId=${encodeURIComponent(VARIANT_ID)}`)
      .then(res => res.json())
      .then(data => {
        setBackendResponse(JSON.stringify(data, null, 2));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || String(err));
        setLoading(false);
      });
  }, []);

  if (!instructions.attributes.canUpdateAttributes) {
    return (
      <Banner title="checkout-ui-api-test" status="warning">
        {translate("attributeChangesAreNotSupported")}
      </Banner>
    );
  }

  return (
    <BlockStack border={"dotted"} padding={"tight"}>
      <Banner title="Admin API Test">Check below for backend response.</Banner>
      <Banner title="checkout-ui-api-test">
        {translate("welcome", {
          target: <Text emphasis="italic">{extension.target}</Text>,
        })}
      </Banner>
      <Checkbox onChange={onCheckboxChange}>
        {translate("iWouldLikeAFreeGiftWithMyOrder")}
      </Checkbox>
      {loading && <Text>Loading backend response...</Text>}
      {error && <Text>Error: {error}</Text>}
      {!loading && backendResponse && (
        <Text>
          Backend response:
          {backendResponse.length > 500
            ? backendResponse.slice(0, 500) + '\n...truncated...'
            : backendResponse}
        </Text>
      )}
    </BlockStack>
  );

  async function onCheckboxChange(isChecked) {
    const result = await applyAttributeChange({
      key: "requestedFreeGift",
      type: "updateAttribute",
      value: isChecked ? "yes" : "no",
    });
    console.log("applyAttributeChange result", result);
  }
}