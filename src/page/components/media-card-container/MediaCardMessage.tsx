import { Component } from "preact";

interface MediaCardMessageProps {
  message: number;
}

export class MediaCardMessage extends Component<MediaCardMessageProps> {
  render() {
    const { message } = this.props;

    return (
      <div
        className={`MediaCardMessageWrapper flex flex-col justify-center items-center absolute w-full h-full transition-all duration-250 animate-[fadeIn_.25s_ease-out] text-(color:--imw-accent)`}
      >
        {message === 0 && (
          <>
            <div className="noresultLogo text-[200px] flex"></div>
            <div className="mt-6 leading-[31px] text-2xl font-bold text-(color:--imw-accent-ink)">
              什么也没有搜到...
            </div>
          </>
        )}
        {message === 1 && (
          <div className="containerSpin flex justify-center items-center absolute w-full h-full text-[100px]"></div>
        )}
        {message === 2 && (
          <>
            <div className="searchLogo text-[200px] flex"></div>
            <div className="mt-6 leading-[31px] text-2xl font-bold text-(color:--imw-accent-ink)">
              请点击搜索图标进行搜索！
            </div>
          </>
        )}
      </div>
    );
  }
}
