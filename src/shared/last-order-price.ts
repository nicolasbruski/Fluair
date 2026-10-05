export interface LastOrderPrice {
  unitPrice: string;
  orderId: string;
  orderNumber: string;
  orderedAt: string;
  customer?: {
    id: string;
    code: string;
    legalName: string;
  };
}
