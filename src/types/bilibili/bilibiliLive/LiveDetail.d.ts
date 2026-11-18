interface LiveRoomDetail {
  code: number;
  msg: string;
  message: string;
  data?: LiveRoomDetailData;
}

interface LiveRoomStatus {
  code: number;
  msg: string;
  message: string;
  data?: LiveRoomStatusData;
}

interface LiveRoomInitDetail {
  code: number;
  msg: string;
  message: string;
  data?: {
    room_id: number; // 直播间长号
    short_id: number; // 直播间短号
    uid: number; // 主播uid
    need_p2p: number; // 是否p2p
    is_hidden: boolean; // 是否隐藏
    is_locked: boolean; // 是否锁定
    is_portrait: boolean; // 是否竖屏
    live_status: number; // 直播状态 0:未开播 1:直播中 2:轮播中
    hidden_till: number; // 隐藏时间戳
    lock_till: number; // 锁定时间戳
    encrypted: boolean; // 是否加密
    pwd_verified: boolean; // 是否验证密码
    live_time: string; // 开播时间 未开播时为-62170012800
    room_shield: number; // 未知
    is_sp: number; // 是否为特殊直播间 0：普通直播间 1：付费直播间
    special_type: number; // 0：普通直播间 1：付费直播间 2：拜年祭直播间
  };
}

interface LiveUserDetail {
  code: number;
  msg: string;
  message: string;
  data?: {
    info: {
      uid: number; // 主播mid
      uname: string; // 主播名称
      face: string; // 头像
      official_verify: {
        type: number; // 主播认证类型 -1: 无 0: 个人认证 1: 机构认证
        desc: string; // 主播认证信息
      }; // 认证信息
      gender: number; // 性别 -1: 保密 1: 女 2: 男
    };
    exp: {
      master_level: {
        level: number; // 主播等级
        color: number; // 等级框颜色
        current: number[]; // 当前等级信息
        next: number[]; // 下一等级信息
      }; // 主播等级
    };
    follower_num: number; // 粉丝数
    room_id: number; // 直播间id（短号）
    medal_name: string; // 粉丝勋章名
    glory_count: number; // 主播荣誉数
    pendant: string; // 直播间头像框url
    link_group_num: number; // 未知
    room_news: {
      content: string; // 公告内容
      ctime: string; // 公告时间
      ctime_text: string; // 公告日期
    }; // 主播公告
  };
}

interface LiveRoomPlayInfoDetail {
  code: number;
  message: string;
  ttl: number;
  data: LiveRoomPlayInfoDetailData;
}

interface LiveRoomDetailData {
  uid: number; // 主播uid
  room_id: number; // 直播间长号
  short_id: number; // 直播间短号
  attention: number; // 关注数
  online: number; // 观看人数
  is_portrait: boolean; // 是否竖屏
  description: string; // 直播间描述
  live_status: number; // 直播状态 0:未开播 1:直播中 2:轮播中
  area_id: number; // 直播分区id
  parent_area_id: number; // 父分区id
  parent_area_name: string; // 父分区名称
  old_area_id: number; // 旧版分区id
  background: string; // 背景图
  title: string; // 直播间标题
  user_cover: string; // 封面
  keyframe: string; // 关键帧
  is_strict_room: boolean; // 未知
  live_time: string; // 开播时间 YYYY-MM-DD HH:mm:ss
  tags: string; // 标签
  is_anchor: boolean; // 未知
  room_silent_type: string; // 禁言状态
  room_silent_level: number; // 禁言等级
  room_silent_second: number; // 禁言时间 单位是秒
  area_name: string; // 分区名称
  pendants: string; // 未知
  area_pendants: string; // 未知
  hot_words: string[]; // 热词
  hot_words_status: number; // 热词状态
  verify: string; // 未知
  new_pendants: {
    frame: {
      name: string; // 名称
      value: string; // 值
      position: number; // 位置
      desc: string; // 描述
      area: number; // 分区
      area_old: number; // 旧版分区
      bg_color: string; // 背景颜色
      bg_pic: string; // 背景图片
      use_old_area: boolean; // 是否旧分区号
    }; // 头像框
    badge: {
      name: string; // 类型 v_person: 个人认证(黄) v_company: 企业认证(蓝)
      position: number; // 位置
      value: string; // 值
      desc: string; // 描述
    }; // 大v
    mobile_frame: {
      name: string; // 名称
      value: string; // 值
      position: number; // 位置
      desc: string; // 描述
      area: number; // 分区
      area_old: number; // 旧版分区
      bg_color: string; // 背景颜色
      bg_pic: string; // 背景图片
      use_old_area: boolean; // 是否旧分区号
    } | null; // 同上
    mobile_badge: {
      name: string; // 类型 v_person: 个人认证(黄) v_company: 企业认证(蓝)
      position: number; // 位置
      value: string; // 值
      desc: string; // 描述
    } | null; // 同上
  }; // 头像框\大v
  up_session: string; // 未知
  pk_status: number; // pk状态
  pk_id: number; // pk id
  battle_id: number; // 未知
  allow_change_area_time: number; // 未知
  allow_upload_cover_time: number; // 未知
  studio_info: {
    status: number; // 未知
    master_list: string[]; // 未知
  };
}

interface LiveRoomStatusData {
  roomStatus: number; // 直播间状态 0:无房间 1:有房间
  roundStatus: number; // 轮播状态 0:无轮播 1:有轮播
  liveStatus: number; // 直播状态 0:未开播 1:直播中
  url: string; // 直播间地址
  title: string; // 直播间标题
  cover: string; // 直播间封面
  online: number; // 直播间人气
  roomid: number; // 直播间id（短号）
  broadcast_type: number; // 未知
  online_hidden: number; // 未知
  link: string; // 未知
}

interface LiveRoomPlayInfoDetailData {
  room_id: number; // 直播间长号
  short_id: number; // 直播间短号
  uid: number; // 主播uid
  is_hidden: boolean; // 直播间是否被隐藏
  is_locked: boolean; // 直播间是否被锁定
  is_portrait: boolean; // 是否竖屏
  live_status: number; // 直播状态 0:未开播 1:直播中 2:轮播中
  hidden_till: number; // 隐藏结束时间
  lock_till: number; // 封禁结束时间
  encrypted: boolean; // 是否加密
  pwd_verified: boolean; // 是否通过密码验证 当encrypted为true时才有意义
  live_time: string; // 开播时间 秒级时间戳
  room_shield: number; // 未知
  all_special_types: number[]; // 未知
  playurl_info: {
    conf_json: string; // 未知
    playurl: {
      cid: number; // 直播间id
      g_qn_desc: {
        qn: number; // 清晰度
        desc: string; // 清晰度描述
        hdr_desc: string; // 未知
        attr_desc: null; // 未知
      }[]; // 清晰度列表
      stream: {
        protocol_name: string; // 协议名
        format: {
          format_name: string; // 格式名
          codec: {
            codec_name: string; // 编码名
            current_qn: number; // 当前清晰度
            accept_qn: number[]; // 支持的清晰度
            base_url: string; // 播放源路径
            url_info: {
              host: string; // 域名
              extra: string; // URL参数
              stream_ttl: number; // 未知
            }[]; // 域名信息列表
            hdr_qn: null; // 未知
            dolby_type: number; // 未知
            attr_name: string; // 未知
          }[]; // 编码列表
        }[];
        master_url: string; // 未知
      }[]; // 直播流信息
      p2p_data: {
        p2p: boolean; // 未知
        p2p_type: number; // 未知
        m_p2p: boolean; // 未知
        m_servers: null; // 未知
      };
      dolby_qn: null; // 未知
    };
  } | null;
  official_type: number; // 未知
  official_room_id: number; // 未知
  risk_with_delay: number; // 未知
}
