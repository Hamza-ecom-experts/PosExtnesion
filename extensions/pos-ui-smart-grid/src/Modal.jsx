import React, { useState, useEffect } from 'react';
import {
  reactExtension,
  useApi,
  Screen,
  Text,
} from '@shopify/ui-extensions-react/point-of-sale';

const VARIANT_ID = "42093858455634";

const SmartGridModal = () => {
  let locationId;
  try {
    const api = useApi();
    const sessionApi = api.session || {};
    const currentSession = sessionApi.currentSession || {};
    locationId = currentSession.locationId;
  } catch (e) {
    locationId = undefined;
  }

  const [availableQty, setAvailableQty] = useState(null);
  const [variantGID, setVariantGID] = useState(null);
  const [locationGID, setLocationGID] = useState(null);

  useEffect(() => {
    if (!locationId) return;
    const vGID = `gid://shopify/ProductVariant/${VARIANT_ID}`;
    const lGID =  `gid://shopify/Location/${locationId}`;
    setVariantGID(vGID);
    setLocationGID(lGID);

    const query = `
      query VariantInventoryLevels($id: ID!) {
        productVariant(id: $id) {
          id
          title
          inventoryItem {
            inventoryLevels(first: 10) {
              nodes {
                location { id name }
                quantities(names: ["available"]) { name quantity }
              }
            }
          }
        }
      }
    `;

    fetch('shopify:admin/api/graphql.json', {
      method: 'POST',
      body: JSON.stringify({ query, variables: { id: vGID } }),
    })
      .then(res => res.json())
      .then(data => {
        const nodes = data?.data?.productVariant?.inventoryItem?.inventoryLevels?.nodes || [];
        const matched = nodes.find(node => node.location.id === lGID);
        const available = matched
          ? matched.quantities.find(q => q.name === 'available')
          : null;
        setAvailableQty(available ? available.quantity : null);
      });
  }, [locationId]);

  return (
    <Screen name="ScreenOne" title="Screen One Title">
      <Text>Variant GID: {variantGID}</Text>
      <Text>Location GID: {locationGID}</Text>
      <Text>Available quantity: {availableQty !== null ? availableQty : 'Not found'}</Text>
    </Screen>
  );
};

export default reactExtension('pos.home.modal.render', () => (
  <SmartGridModal />
));