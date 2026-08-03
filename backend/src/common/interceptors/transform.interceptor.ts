import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  success: true;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T> | StreamableFile> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T> | StreamableFile> {
    return next.handle().pipe(
      map((data) =>
        // A file is already the whole response body. Putting it inside the
        // envelope would serialise the stream object itself — a couple of
        // hundred bytes of JSON where the caller was expecting an image.
        data instanceof StreamableFile ? data : { success: true as const, data },
      ),
    );
  }
}
