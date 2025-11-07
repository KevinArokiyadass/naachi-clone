import { ErrorException } from "../errors/custom-error.exception";
import { interServiceRequestHelper } from "./axios-wrapper";


export async function sendRequestToService({
  method,
  service,
  requestPath,
  query = {},
  throwException = true,
  timeout,
  retries = 3,
  retryDelay = 1000,
}: {
  method: string;
  service: string;
  requestPath: string;
  query?: Record<string, any>;
  throwException?: boolean;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}): Promise<any | Error> {
  try {
    const response = await interServiceRequestHelper({
      method: 'get',
      service,
      requestPath,
      query,
      throwException,
      timeout,
      retries,
      retryDelay
    });
    return response;
  } catch (error) {
    let errorMessage = 'SOMETHING_WENT_WRONG';
    let statusCode = 500 
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
      statusCode = error.response.status || statusCode;
    } else if (error.message) {
      errorMessage = error.message;
      statusCode = error.status || statusCode
    }
    if (throwException) {
      throw new ErrorException(null, errorMessage, statusCode);
    }
    return null;
  }
}
