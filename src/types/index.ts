/** 一级分类 */
export interface MainCategory {
  id: number
  name: string
  icon: string
  sort_order: number
}

/** 二级分类 */
export interface SubCategory {
  id: number
  main_category_id: number
  name: string
  sort_order: number
}

/** 带一级分类信息的二级分类 */
export interface SubCategoryWithMain extends SubCategory {
  main_name: string
  main_icon: string
}

/** 账单记录 */
export interface Bill {
  id: number
  amount: number
  category_id: number
  bill_date: string
  remark: string
  created_at: string
  updated_at: string
  /** 关联查询：二级分类名称 */
  sub_category_name?: string
  /** 关联查询：一级分类名称 */
  main_category_name?: string
  /** 关联查询：一级分类图标 */
  main_category_icon?: string
}

/** 新增账单的表单数据 */
export interface BillFormData {
  amount: number
  category_id: number
  bill_date: string
  remark: string
}

/** 分类统计 */
export interface CategoryStat {
  main_category_id: number
  main_category_name: string
  main_category_icon: string
  total: number
  count: number
}

/** 月度统计 */
export interface MonthlyStat {
  month: string
  total: number
  count: number
}

/** Cascader 选项结构 */
export interface CascaderOption {
  value: number
  label: string
  children?: CascaderOption[]
}
