import { gql } from '@apollo/client';

export const HEALTH_QUERY = gql`
  query Health {
    health
  }
`;

export const PRODUCTS_QUERY = gql`
  query Products($phaseFamily: String, $variant: String) {
    products(phaseFamily: $phaseFamily, variant: $variant) {
      id
      sku
      name
      phaseFamily
      variant
      accountSize
      price
      comparePrice
      isMostPopular
    }
  }
`;

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      displayName
      role
    }
  }
`;

export const LOGIN_HISTORY_QUERY = gql`
  query LoginHistory {
    loginHistory {
      id
      ip
      country
      countryCode
      city
      isp
      org
      connectionKind
      connectionLabel
      isVpn
      isVps
      createdAt
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!, $clientIp: String) {
    login(email: $email, password: $password, clientIp: $clientIp) {
      userId
      email
      displayName
      role
      accessToken
    }
  }
`;
