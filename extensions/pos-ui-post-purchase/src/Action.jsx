import React from 'react';

import {
  Text,
  Screen,
  ScrollView,
  Navigator,
  useApi,
  reactExtension,
} from '@shopify/ui-extensions-react/point-of-sale';

const Modal = () => {
  const api = useApi();
  
  return (
    <Navigator>
      <Screen name="PostPurchaseAction" title="Post Purchase Action">
        <ScrollView>
          <Text>{`Order ID for complete checkout: ${api.order.id}`}</Text>
        </ScrollView>
      </Screen>
    </Navigator>
  );
};

export default reactExtension('pos.purchase.post.action.render', () => (
  <Modal />
));