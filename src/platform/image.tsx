import Image, {type ImageProps} from 'next/image';
import {backendImageUrl} from './backend-transport';

export default function BackendImage(props: ImageProps) {
  return <Image {...props} alt={props.alt} src={typeof props.src === 'string' ? backendImageUrl(props.src) : props.src}/>;
}
